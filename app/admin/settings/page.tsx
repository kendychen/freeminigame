import { requireSuperAdmin } from "@/lib/auth";
import { MaintenanceForm } from "./MaintenanceForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const { supabase } = await requireSuperAdmin();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .maybeSingle();
  const v = (data?.value ?? {}) as { enabled?: boolean; message?: string };
  return (
    <MaintenanceForm
      enabled={v.enabled ?? false}
      message={v.message ?? ""}
    />
  );
}
