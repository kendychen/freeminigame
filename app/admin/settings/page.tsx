import { requireSuperAdmin } from "@/lib/auth";
import { parseUiTheme } from "@/lib/ui-theme";
import { MaintenanceForm } from "./MaintenanceForm";
import { UiThemeForm } from "./UiThemeForm";
import { TvLayoutForm } from "./TvLayoutForm";
import { PairPinsForm } from "./PairPinsForm";
import { parseTvLayout } from "@/lib/tv-layout";
import { fallbackPinSpec, parsePinSetting } from "@/lib/pair/default-pins";
import { PAIR_PINS_KEY } from "@/lib/pair/default-pins-store";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const { supabase } = await requireSuperAdmin();
  const { data } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["maintenance_mode", "ui_theme", "tv_layout", PAIR_PINS_KEY]);
  const byKey = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  const v = (byKey.get("maintenance_mode") ?? {}) as { enabled?: boolean; message?: string };
  // Chưa có hàng nào trong DB → hiện giá trị mà route bốc thăm đang thực sự
  // dùng (env/built-in), để ô cấu hình không nói dối là "đang tắt".
  const storedPins = byKey.has(PAIR_PINS_KEY)
    ? parsePinSetting(byKey.get(PAIR_PINS_KEY))
    : null;
  return (
    <div className="space-y-6">
      <UiThemeForm theme={parseUiTheme(byKey.get("ui_theme"))} />
      <TvLayoutForm layout={parseTvLayout(byKey.get("tv_layout"))} />
      <PairPinsForm spec={storedPins ?? fallbackPinSpec()} />
      <MaintenanceForm
        enabled={v.enabled ?? false}
        message={v.message ?? ""}
      />
    </div>
  );
}
