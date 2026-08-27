import { requireSuperAdmin } from "@/lib/auth";
import { parseUiTheme } from "@/lib/ui-theme";
import { MaintenanceForm } from "./MaintenanceForm";
import { UiThemeForm } from "./UiThemeForm";
import { TvLayoutForm } from "./TvLayoutForm";
import { parseTvLayout } from "@/lib/tv-layout";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const { supabase } = await requireSuperAdmin();
  const { data } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["maintenance_mode", "ui_theme", "tv_layout"]);
  const byKey = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  const v = (byKey.get("maintenance_mode") ?? {}) as { enabled?: boolean; message?: string };
  return (
    <div className="space-y-6">
      <UiThemeForm theme={parseUiTheme(byKey.get("ui_theme"))} />
      <TvLayoutForm layout={parseTvLayout(byKey.get("tv_layout"))} />
      <MaintenanceForm
        enabled={v.enabled ?? false}
        message={v.message ?? ""}
      />
    </div>
  );
}
