"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth";

export async function adminSoftDelete(id: string) {
  const { supabase } = await requireSiteAdmin();
  const { error } = await supabase
    .from("tournaments")
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .eq("id", id);
  if (error) return { error: error.message } as const;
  revalidatePath("/admin/tournaments");
  return { ok: true } as const;
}

export async function adminRestore(id: string) {
  const { supabase } = await requireSiteAdmin();
  const { error } = await supabase
    .from("tournaments")
    .update({ deleted_at: null, status: "draft" })
    .eq("id", id);
  if (error) return { error: error.message } as const;
  revalidatePath("/admin/tournaments");
  return { ok: true } as const;
}

export async function adminToggleFeatured(id: string, value: boolean) {
  const { supabase } = await requireSiteAdmin();
  const { error } = await supabase
    .from("tournaments")
    .update({ is_featured: value })
    .eq("id", id);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}
