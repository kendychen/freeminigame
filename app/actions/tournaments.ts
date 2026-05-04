"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureSafeSlug, withRandomSuffix } from "@/lib/slug";
import type { TournamentFormat } from "@/lib/pairing/types";
import type { TieBreakerConfig } from "@/lib/standings/types";

export interface CreateTournamentInput {
  name: string;
  format: TournamentFormat;
  isPublic: boolean;
  seriesFormat: "bo1" | "bo3" | "bo5";
  config: Record<string, unknown>;
}

export async function createTournament(input: CreateTournamentInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" } as const;

  // Ensure profile exists (resilient if handle_new_user trigger missed)
  const svc = createServiceClient();
  await svc.from("profiles").upsert(
    {
      id: user.id,
      display_name:
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "User",
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  let slug = ensureSafeSlug(input.name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("tournaments").insert({
      slug,
      name: input.name,
      format: input.format,
      is_public: input.isPublic,
      owner_id: user.id,
      config: { ...input.config, seriesFormat: input.seriesFormat },
    });
    if (!error) break;
    if (!String(error.message).toLowerCase().includes("duplicate")) {
      return { error: error.message } as const;
    }
    slug = withRandomSuffix(ensureSafeSlug(input.name));
    if (attempt === 4) return { error: "slug_conflict" } as const;
  }

  // Bind owner role (use service role to bypass any RLS hiccups)
  const { data: t } = await svc
    .from("tournaments")
    .select("id, slug")
    .eq("slug", slug)
    .single();
  if (t) {
    await svc
      .from("tournament_admins")
      .upsert({ tournament_id: t.id, admin_id: user.id, role: "owner" });
  }
  revalidatePath("/dashboard");
  return { slug } as const;
}

export async function softDeleteTournament(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .eq("id", id);
  if (error) return { error: error.message } as const;
  revalidatePath("/dashboard");
  return { ok: true } as const;
}

export async function togglePublic(id: string, isPublic: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ is_public: isPublic })
    .eq("id", id);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

/**
 * Owner-only: invite an existing Hội Nhóm Pickleball user as a co_admin / viewer
 * by their email. The invitee must already have an account; we surface
 * a friendly 'user_not_registered' error otherwise.
 */
export async function inviteCoAdmin(input: {
  tournamentId: string;
  email: string;
  role: "co_admin" | "viewer";
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" } as const;

  // Verify caller is the owner
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, owner_id")
    .eq("id", input.tournamentId)
    .maybeSingle();
  if (!t) return { error: "tournament_not_found" } as const;
  if (t.owner_id !== user.id) return { error: "forbidden" } as const;

  const cleanEmail = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { error: "invalid_email" } as const;
  }

  // Find user by email via service role (auth.users is admin-only)
  const svc = createServiceClient();
  const { data: list, error: listErr } = await svc.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) return { error: listErr.message } as const;
  const target = list.users.find(
    (u) => u.email?.toLowerCase() === cleanEmail,
  );
  if (!target) return { error: "user_not_registered" } as const;
  if (target.id === user.id) return { error: "cannot_invite_self" } as const;

  // Upsert tournament_admins row
  const { error } = await svc.from("tournament_admins").upsert(
    {
      tournament_id: input.tournamentId,
      admin_id: target.id,
      role: input.role,
    },
    { onConflict: "tournament_id,admin_id" },
  );
  if (error) return { error: error.message } as const;
  // Make sure their profile row exists for display
  await svc.from("profiles").upsert(
    {
      id: target.id,
      display_name:
        (target.user_metadata?.full_name as string | undefined) ??
        target.email?.split("@")[0] ??
        "User",
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  revalidatePath(`/t`, "layout");
  return {
    ok: true,
    invitedUserId: target.id,
    invitedEmail: target.email ?? cleanEmail,
  } as const;
}

/**
 * Owner-only: remove a co_admin / viewer from a tournament.
 * Refuses to remove the owner row itself.
 */
export async function removeCoAdmin(input: {
  tournamentId: string;
  adminId: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" } as const;

  const { data: t } = await supabase
    .from("tournaments")
    .select("id, owner_id")
    .eq("id", input.tournamentId)
    .maybeSingle();
  if (!t) return { error: "tournament_not_found" } as const;
  if (t.owner_id !== user.id) return { error: "forbidden" } as const;
  if (t.owner_id === input.adminId) {
    return { error: "cannot_remove_owner" } as const;
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("tournament_admins")
    .delete()
    .eq("tournament_id", input.tournamentId)
    .eq("admin_id", input.adminId);
  if (error) return { error: error.message } as const;
  revalidatePath(`/t`, "layout");
  return { ok: true } as const;
}

/** Owner-only: change role of an existing admin. */
export async function setCoAdminRole(input: {
  tournamentId: string;
  adminId: string;
  role: "co_admin" | "viewer";
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" } as const;
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, owner_id")
    .eq("id", input.tournamentId)
    .maybeSingle();
  if (!t) return { error: "tournament_not_found" } as const;
  if (t.owner_id !== user.id) return { error: "forbidden" } as const;
  if (t.owner_id === input.adminId) {
    return { error: "cannot_change_owner" } as const;
  }
  const svc = createServiceClient();
  const { error } = await svc
    .from("tournament_admins")
    .update({ role: input.role })
    .eq("tournament_id", input.tournamentId)
    .eq("admin_id", input.adminId);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

export async function updatePlateConfig(input: {
  tournamentId: string;
  plateEnabled: boolean;
  qualifyPerGroup: number;
  qualifyPlatePerGroup: number;
}) {
  const supabase = await createClient();
  const { data: t, error: readErr } = await supabase
    .from("tournaments")
    .select("config")
    .eq("id", input.tournamentId)
    .single();
  if (readErr) return { error: readErr.message } as const;

  // Refuse if knockout already promoted (config change would mismatch existing matches)
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", input.tournamentId)
    .in("bracket", ["main", "plate"]);
  if ((count ?? 0) > 0) return { error: "already_promoted" } as const;

  const cfg = ((t?.config as Record<string, unknown> | null) ?? {});
  const next = {
    ...cfg,
    plateEnabled: input.plateEnabled,
    qualifyPerGroup: Math.max(1, input.qualifyPerGroup),
    qualifyPlatePerGroup: Math.max(0, input.qualifyPlatePerGroup),
  };
  const { error } = await supabase
    .from("tournaments")
    .update({ config: next })
    .eq("id", input.tournamentId);
  if (error) return { error: error.message } as const;
  revalidatePath(`/t`, "layout");
  return { ok: true } as const;
}

export async function updateTournamentTiebreakers(input: {
  tournamentId: string;
  tiebreakers: TieBreakerConfig[];
}) {
  const supabase = await createClient();
  const { data: t, error: readErr } = await supabase
    .from("tournaments")
    .select("config")
    .eq("id", input.tournamentId)
    .single();
  if (readErr) return { error: readErr.message } as const;

  const cfg = ((t?.config as Record<string, unknown> | null) ?? {});
  const next = { ...cfg, tiebreakers: input.tiebreakers };
  const { error } = await supabase
    .from("tournaments")
    .update({ config: next })
    .eq("id", input.tournamentId);
  if (error) return { error: error.message } as const;
  revalidatePath(`/t`, "layout");
  return { ok: true } as const;
}
