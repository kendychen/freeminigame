"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth";

export async function forceExpireQuickShare(code: string) {
  const { supabase } = await requireSiteAdmin();
  const { error } = await supabase
    .from("quick_brackets")
    .update({ expires_at: new Date().toISOString() })
    .eq("code", code);
  if (error) return { error: error.message } as const;
  revalidatePath("/admin/quick-brackets");
  return { ok: true } as const;
}
