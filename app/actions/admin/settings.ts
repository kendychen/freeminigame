"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { UI_THEMES, type UiTheme } from "@/lib/ui-theme";
import { TV_LAYOUTS, type TvLayout } from "@/lib/tv-layout";
import { parseDefaultPinSpec } from "@/lib/pair/default-pins";
import { PAIR_PINS_KEY } from "@/lib/pair/default-pins-store";

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

/**
 * Cặp ghim cố định cho toàn bộ giải đấu. `spec` rỗng = tắt.
 * Chuẩn hoá về "A|B;C|D" và bỏ nhóm dưới 2 tên để DB không giữ rác.
 */
export async function setPairDefaultPins(spec: string) {
  if (spec.length > 2000) return { error: "spec_too_long" } as const;
  const groups = parseDefaultPinSpec(spec);
  const normalized = groups.map((g) => g.join("|")).join(";");
  const { user, supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("site_settings").upsert({
    key: PAIR_PINS_KEY,
    value: { spec: normalized },
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message } as const;
  // Các route bốc thăm đọc trực tiếp từ DB mỗi lượt, nên không có cache nào
  // cần xoá; revalidate chỉ để trang /admin/settings hiện giá trị mới.
  revalidatePath("/admin/settings");
  return { ok: true, spec: normalized } as const;
}

export async function setTvLayout(layout: TvLayout) {
  if (!TV_LAYOUTS.includes(layout)) return { error: "invalid_layout" } as const;
  const { user, supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("site_settings").upsert({
    key: "tv_layout",
    value: { layout },
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message } as const;
  revalidatePath("/", "layout");
  return { ok: true } as const;
}
