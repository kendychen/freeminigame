import { requireSiteAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CapacityDashboard } from "@/components/admin/capacity-dashboard";
import { fetchDbMetrics } from "@/app/actions/admin/metrics";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const { supabase } = await requireSiteAdmin();

  // Load both in parallel: snapshot (static hourly) + live DB metrics
  const [snapshotResult, dbMetrics] = await Promise.all([
    supabase
      .from("site_settings")
      .select("value, updated_at")
      .eq("key", "health_snapshot")
      .maybeSingle(),
    fetchDbMetrics().catch(() => null),
  ]);

  const snap = (snapshotResult.data?.value ?? {}) as Record<string, unknown>;
  const updated = snapshotResult.data?.updated_at;

  const snapshotCards = [
    { label: "Supabase rows", key: "supabase_rows", suffix: "" },
    { label: "Storage MB", key: "storage_mb", suffix: " MB" },
    { label: "Bandwidth MB", key: "bandwidth_mb", suffix: " MB" },
    { label: "Realtime conn", key: "realtime_conn", suffix: "" },
    { label: "Sentry errors 7d", key: "sentry_errors_7d", suffix: "" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Live capacity monitor ───────────────────── */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Giám sát sức chịu tải</h2>
        <CapacityDashboard initialMetrics={dbMetrics} />
      </div>

      {/* ── Hourly snapshot (existing) ──────────────── */}
      <div>
        <h2 className="mb-1 text-lg font-semibold">Snapshot định kỳ</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Cập nhật lúc{" "}
          {updated ? new Date(updated).toLocaleString("vi-VN") : "chưa có"}.
          Worker hourly cập nhật snapshot vào site_settings.health_snapshot.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {snapshotCards.map((c) => {
            const v = snap[c.key];
            const display = v == null ? "—" : `${v}${c.suffix}`;
            return (
              <Card key={c.key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {c.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{display}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Snapshot raw</CardTitle>
            <CardDescription>JSON từ site_settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md border bg-secondary/50 p-3 text-xs">
              {JSON.stringify(snap, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
