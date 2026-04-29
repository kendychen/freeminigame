"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { forceExpireQuickShare } from "@/app/actions/admin/quick-brackets";
import { toast } from "@/components/ui/toast";

interface Row {
  code: string;
  format: string;
  team_count: number;
  view_count: number;
  created_at: string;
  expires_at: string;
}

export function QuickBracketsAdminClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();

  const onExpire = (code: string) =>
    start(async () => {
      const res = await forceExpireQuickShare(code);
      if ("error" in res) {
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
        return;
      }
      setRows((p) =>
        p.map((x) =>
          x.code === code ? { ...x, expires_at: new Date().toISOString() } : x,
        ),
      );
    });

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs uppercase">
          <tr>
            <th className="px-3 py-2 text-left">Mã</th>
            <th className="px-3 py-2">Thể thức</th>
            <th className="px-3 py-2">Đội</th>
            <th className="px-3 py-2">Lượt xem</th>
            <th className="px-3 py-2">Hết hạn</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const expired = new Date(r.expires_at).getTime() < Date.now();
            return (
              <tr key={r.code} className={expired ? "border-t opacity-60" : "border-t"}>
                <td className="px-3 py-2 font-mono">
                  <Link href={`/quick/share/${r.code}`} className="hover:underline">
                    {r.code}
                  </Link>
                </td>
                <td className="px-3 py-2 text-center capitalize">
                  {r.format.replace("_", " ")}
                </td>
                <td className="px-3 py-2 text-center">{r.team_count}</td>
                <td className="px-3 py-2 text-center">{r.view_count}</td>
                <td className="px-3 py-2 text-center text-xs">
                  {new Date(r.expires_at).toLocaleString("vi-VN")}
                </td>
                <td className="px-3 py-2 text-right">
                  {!expired && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onExpire(r.code)}
                      disabled={pending}
                    >
                      Hết hạn ngay
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
