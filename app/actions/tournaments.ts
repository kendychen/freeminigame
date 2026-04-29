"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureSafeSlug, withRandomSuffix } from "@/lib/slug";
import type { TournamentFormat } from "@/lib/pairing/types";

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
