"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface Row {
  id: string;
  slug: string;
  name: string;
  stage: string;
  owner_id: string;
  playerCount: number;
  created_at: string;
}

const STAGE_LABEL: Record<string, string> = {
  group: "Vòng bảng",
  draw: "Bốc thăm",
  knockout: "Knockout",
  done: "Kết thúc",
};

const STAGE_COLOR: Record<string, string> = {
  group: "bg-blue-500/15 text-blue-600",
  draw: "bg-yellow-500/15 text-yellow-600",
  knockout: "bg-orange-500/15 text-orange-600",
  done: "bg-green-500/15 text-green-600",
};

export default function PicAdminClient({ initial }: { initial: Row[] }) {
  const [filter, setFilter] = useState("");

  const filtered = initial.filter(
    (r) =>
      !filter ||
      r.name.toLowerCase().includes(filter.toLowerCase()) ||
      r.slug.toLowerCase().includes(filter.toLowerCase()) ||
      r.owner_id.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">PIC Xoay Cặp</h1>
        <span className="text-sm text-muted-foreground">{initial.length} giải</span>
      </div>
      <input
        placeholder="Tìm theo tên, slug, owner ID…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-md rounded-md border bg-background px-3 py-2 text-sm"
      />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Tên giải</th>
              <th className="px-3 py-2 text-left">Slug</th>
              <th className="px-3 py-2 text-center">Giai đoạn</th>
              <th className="px-3 py-2 text-center">VĐV</th>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-left">Tạo lúc</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.slug}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLOR[r.stage] ?? "bg-muted text-muted-foreground"}`}>
                    {STAGE_LABEL[r.stage] ?? r.stage}
                  </span>
                </td>
                <td className="px-3 py-2 text-center font-mono">{r.playerCount}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground truncate max-w-[140px]">{r.owner_id}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString("vi-VN")}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/pic/${r.slug}/matches`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                  >
                    <ExternalLink className="size-3" />
                    Xem
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Không tìm thấy giải nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
