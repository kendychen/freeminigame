"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, RefreshCcw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminRestore,
  adminSoftDelete,
  adminToggleFeatured,
} from "@/app/actions/admin/tournaments";
import { toast } from "@/components/ui/toast";

interface Row {
  id: string;
  slug: string;
  name: string;
  status: string;
  format: string;
  owner_id: string;
  is_public: boolean;
  is_featured: boolean;
  deleted_at: string | null;
  created_at: string;
}

export function TournamentsAdminClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");

  const filtered = rows.filter(
    (r) =>
      !filter ||
      r.name.toLowerCase().includes(filter.toLowerCase()) ||
      r.slug.toLowerCase().includes(filter.toLowerCase()),
  );

  const onDelete = (id: string) =>
    start(async () => {
      const res = await adminSoftDelete(id);
      if ("error" in res) toast({ title: "Lỗi", description: res.error, variant: "destructive" });
      else
        setRows((p) =>
          p.map((x) =>
            x.id === id ? { ...x, deleted_at: new Date().toISOString(), status: "archived" } : x,
          ),
        );
    });

  const onRestore = (id: string) =>
    start(async () => {
      const res = await adminRestore(id);
      if ("error" in res) toast({ title: "Lỗi", description: res.error, variant: "destructive" });
      else
        setRows((p) =>
          p.map((x) => (x.id === id ? { ...x, deleted_at: null, status: "draft" } : x)),
        );
    });

  const onFeature = (id: string, value: boolean) =>
    start(async () => {
      const res = await adminToggleFeatured(id, value);
      if ("error" in res) toast({ title: "Lỗi", description: res.error, variant: "destructive" });
      else setRows((p) => p.map((x) => (x.id === id ? { ...x, is_featured: value } : x)));
    });

  return (
    <div className="space-y-4">
      <input
        placeholder="Tìm theo tên hoặc slug…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-md rounded-md border bg-background px-3 py-2 text-sm"
      />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Tên</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Thể thức</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={r.deleted_at ? "border-t opacity-60" : "border-t"}>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/t/${r.slug}`} className="hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.slug}</td>
                <td className="px-3 py-2 text-center">{r.status}</td>
                <td className="px-3 py-2 text-center capitalize">
                  {r.format.replace("_", " ")}
                </td>
                <td className="flex justify-end gap-1 px-3 py-2">
                  <Button
                    size="sm"
                    variant={r.is_featured ? "default" : "ghost"}
                    onClick={() => onFeature(r.id, !r.is_featured)}
                    disabled={pending}
                    title="Featured"
                  >
                    <Star className="size-4" />
                  </Button>
                  {r.deleted_at ? (
                    <Button size="sm" variant="outline" onClick={() => onRestore(r.id)} disabled={pending}>
                      <RefreshCcw className="size-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)} disabled={pending}>
                      <Trash2 className="size-4" />
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
