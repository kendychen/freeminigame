"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { softDeleteTournament, togglePublic } from "@/app/actions/tournaments";
import type { DbTournament } from "@/types/database";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";

export function SettingsClient({ tournament }: { tournament: DbTournament }) {
  const router = useRouter();
  const [isPublic, setPublic] = useState(tournament.is_public);
  const [pending, start] = useTransition();

  const onTogglePublic = () =>
    start(async () => {
      const next = !isPublic;
      const res = await togglePublic(tournament.id, next);
      if ("error" in res) {
        toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
      } else {
        setPublic(next);
        toast({ title: next ? "Đã công khai" : "Đã ẩn" });
      }
    });

  const onDelete = () => {
    if (!confirm("Xoá giải đấu này? Có thể khôi phục bởi super_admin.")) return;
    start(async () => {
      const res = await softDeleteTournament(tournament.id);
      if ("error" in res) {
        toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
      } else {
        router.push("/dashboard");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Hiển thị</CardTitle>
          <CardDescription>Bật/tắt chế độ công khai cho viewer.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onTogglePublic} disabled={pending}>
            {isPublic ? "Đang công khai · Click để ẩn" : "Đang ẩn · Click để công khai"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Vùng nguy hiểm</CardTitle>
          <CardDescription>
            Xoá giải đấu (soft-delete). Có thể khôi phục bởi super_admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={onDelete} disabled={pending}>
            Xoá giải đấu
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
