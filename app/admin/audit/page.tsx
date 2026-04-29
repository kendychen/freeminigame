import { requireSiteAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAudit({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; action?: string }>;
}) {
  const { supabase } = await requireSiteAdmin();
  const sp = await searchParams;
  let q = supabase
    .from("audit_logs")
    .select("id, action, table_name, record_id, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (sp.table) q = q.eq("table_name", sp.table);
  if (sp.action) q = q.eq("action", sp.action);
  const { data } = await q;
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2 text-sm" method="get">
        <input
          name="table"
          placeholder="table_name"
          defaultValue={sp.table ?? ""}
          className="rounded-md border bg-background px-3 py-2"
        />
        <select
          name="action"
          defaultValue={sp.action ?? ""}
          className="rounded-md border bg-background px-3 py-2"
        >
          <option value="">action (any)</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
        <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Lọc
        </button>
      </form>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Thời gian</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Bảng</th>
              <th className="px-3 py-2">Record</th>
              <th className="px-3 py-2">User</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 text-xs">
                  {new Date(r.created_at).toLocaleString("vi-VN")}
                </td>
                <td className="px-3 py-2 text-center">{r.action}</td>
                <td className="px-3 py-2 text-center">{r.table_name}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.record_id ? r.record_id.slice(0, 8) + "…" : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.user_id ? r.user_id.slice(0, 8) + "…" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
