"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";

export async function setMaintenance(input: {
  enabled: boolean;
  message: string;
}) {
  const { user, supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("site_settings").upsert({
    key: "maintenance_mode",
    value: { enabled: input.enabled, message: input.message },
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message } as const;
  revalidatePath("/", "layout");
  return { ok: true } as const;
}
