"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { banUser, setSiteRole, unbanUser } from "@/app/actions/admin/users";
import { toast } from "@/components/ui/toast";

interface Row {
  id: string;
  display_name: string | null;
  site_role: "user" | "moderator" | "super_admin";
  created_at: string;
}

interface BanRow {
  user_id: string;
  reason: string;
  banned_until: string | null;
}

export function UsersAdminClient({
  initial,
  banMap,
}: {
  initial: Row[];
  banMap: Record<string, BanRow>;
}) {
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");

  const filtered = rows.filter(
    (r) =>
      !search ||
      r.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.id.includes(search),
  );

  const onChangeRole = (userId: string, role: Row["site_role"]) =>
    start(async () => {
      const res = await setSiteRole({ userId, role });
      if ("error" in res) {
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
        return;
      }
      setRows((p) => p.map((x) => (x.id === userId ? { ...x, site_role: role } : x)));
    });

  const onBan = (userId: string) =>
    start(async () => {
      const reason = prompt("Lý do ban:");
      if (!reason) return;
      const res = await banUser({ userId, reason });
      if ("error" in res) {
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Đã ban" });
    });

  const onUnban = (userId: string) =>
    start(async () => {
      const res = await unbanUser(userId);
      if ("error" in res) {
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Đã unban" });
    });

  return (
    <div className="space-y-4">
      <Input
        placeholder="Tìm theo tên/UUID…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Tên</th>
              <th className="px-3 py-2 text-left">UUID</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Ban</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.display_name ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.id.slice(0, 8)}…</td>
                <td className="px-3 py-2 text-center">
                  <Select
                    value={r.site_role}
                    onChange={(e) =>
                      onChangeRole(r.id, e.target.value as Row["site_role"])
                    }
                    disabled={pending}
                  >
                    <option value="user">user</option>
                    <option value="moderator">moderator</option>
                    <option value="super_admin">super_admin</option>
                  </Select>
                </td>
                <td className="px-3 py-2 text-center text-xs">
                  {banMap[r.id] ? (
                    <span className="text-destructive">{banMap[r.id]!.reason}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="flex justify-end gap-1 px-3 py-2">
                  {banMap[r.id] ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUnban(r.id)}
                      disabled={pending}
                    >
                      Unban
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onBan(r.id)}
                      disabled={pending}
                    >
                      Ban
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
