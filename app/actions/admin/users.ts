"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function setSiteRole(input: {
  userId: string;
  role: "user" | "moderator" | "super_admin";
}) {
  const { user, supabase } = await requireSuperAdmin();
  if (input.userId === user.id && input.role !== "super_admin") {
    return { error: "cannot_self_demote" } as const;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ site_role: input.role })
    .eq("id", input.userId);
  if (error) return { error: error.message } as const;
  revalidatePath("/admin/users");
  return { ok: true } as const;
}

export async function banUser(input: {
  userId: string;
  reason: string;
  bannedUntil?: string | null;
}) {
  const { user, supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("user_bans").upsert({
    user_id: input.userId,
    reason: input.reason,
    banned_until: input.bannedUntil ?? null,
    banned_by: user.id,
  });
  if (error) return { error: error.message } as const;
  // Force-signout banned user
  try {
    const svc = createServiceClient();
    await svc.auth.admin.signOut(input.userId, "global");
  } catch {
    // ignore if service role not configured
  }
  revalidatePath("/admin/users");
  return { ok: true } as const;
}

export async function unbanUser(userId: string) {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("user_bans").delete().eq("user_id", userId);
  if (error) return { error: error.message } as const;
  revalidatePath("/admin/users");
  return { ok: true } as const;
}
