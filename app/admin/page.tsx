import { requireSiteAdmin } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const { supabase } = await requireSiteAdmin();
  const sevenDays = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const thirtyDays = new Date(Date.now() - 30 * 86400 * 1000).toISOString();

  const [
    { count: totalTournaments },
    { count: tournaments7d },
    { count: tournaments30d },
    { count: totalUsers },
    { count: quickAlive },
  ] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("tournaments")
      .select("id", { count: "exact", head: true })
      .gt("created_at", sevenDays)
      .is("deleted_at", null),
    supabase
      .from("tournaments")
      .select("id", { count: "exact", head: true })
      .gt("created_at", thirtyDays)
      .is("deleted_at", null),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("quick_brackets")
      .select("code", { count: "exact", head: true })
      .gt("expires_at", new Date().toISOString()),
  ]);

  const { data: recent } = await supabase
    .from("audit_logs")
    .select("id, action, table_name, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const stats = [
    { label: "Tổng giải đấu", value: totalTournaments ?? 0 },
    { label: "Giải mới 7 ngày", value: tournaments7d ?? 0 },
    { label: "Giải mới 30 ngày", value: tournaments30d ?? 0 },
    { label: "Người dùng", value: totalUsers ?? 0 },
    { label: "Quick shares đang sống", value: quickAlive ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Hoạt động gần đây</CardTitle>
          <CardDescription>20 sự kiện audit log mới nhất.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Thời gian</th>
                  <th className="px-3 py-2 text-left">Hành động</th>
                  <th className="px-3 py-2 text-left">Bảng</th>
                  <th className="px-3 py-2 text-left">User</th>
                </tr>
              </thead>
              <tbody>
                {(recent ?? []).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 text-xs">
                      {new Date(r.created_at).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-3 py-2">{r.action}</td>
                    <td className="px-3 py-2">{r.table_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.user_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
