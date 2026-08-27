"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { UI_THEMES, type UiTheme } from "@/lib/ui-theme";

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

export async function setUiTheme(theme: UiTheme) {
  if (!UI_THEMES.includes(theme)) return { error: "invalid_theme" } as const;
  const { user, supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("site_settings").upsert({
    key: "ui_theme",
    value: { theme },
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message } as const;
  revalidatePath("/", "layout");
  return { ok: true } as const;
}
