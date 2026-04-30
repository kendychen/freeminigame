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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  softDeleteTournament,
  togglePublic,
  updatePlateConfig,
} from "@/app/actions/tournaments";
import type { DbTournament } from "@/types/database";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";

export function SettingsClient({ tournament }: { tournament: DbTournament }) {
  const router = useRouter();
  const [isPublic, setPublic] = useState(tournament.is_public);
  const [pending, start] = useTransition();

  const cfg = (tournament.config ?? {}) as {
    plateEnabled?: boolean;
    qualifyPerGroup?: number;
    qualifyPlatePerGroup?: number;
  };
  const isGroupKO = tournament.format === "group_knockout";
  const [plateEnabled, setPlateEnabled] = useState(!!cfg.plateEnabled);
  const [qpg, setQpg] = useState<number>(cfg.qualifyPerGroup ?? 2);
  const [qpgPlate, setQpgPlate] = useState<number>(
    cfg.qualifyPlatePerGroup ?? 1,
  );

  const onSavePlate = () =>
    start(async () => {
      const res = await updatePlateConfig({
        tournamentId: tournament.id,
        plateEnabled,
        qualifyPerGroup: qpg,
        qualifyPlatePerGroup: qpgPlate,
      });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
      } else {
        toast({ title: "Đã lưu cấu hình" });
        router.refresh();
      }
    });

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

      {isGroupKO && (
        <Card>
          <CardHeader>
            <CardTitle>Cúp phụ (Series B)</CardTitle>
            <CardDescription>
              Chia 2 nhánh đấu sau vòng bảng: top vào Cúp chính, kế tiếp vào Cúp phụ.
              Chỉ chỉnh được trước khi tạo knockout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={plateEnabled}
                onChange={(e) => setPlateEnabled(e.target.checked)}
                className="size-4 accent-primary"
              />
              Bật Cúp phụ
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="qpg">Số đội/bảng vào Cúp chính</Label>
                <Input
                  id="qpg"
                  type="number"
                  min={1}
                  max={8}
                  value={qpg}
                  onChange={(e) =>
                    setQpg(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </div>
              <div>
                <Label htmlFor="qpgp">Số đội/bảng vào Cúp phụ</Label>
                <Input
                  id="qpgp"
                  type="number"
                  min={0}
                  max={8}
                  value={qpgPlate}
                  onChange={(e) =>
                    setQpgPlate(Math.max(0, Number(e.target.value) || 0))
                  }
                  disabled={!plateEnabled}
                />
              </div>
            </div>
            <Button onClick={onSavePlate} disabled={pending}>
              Lưu cấu hình
            </Button>
          </CardContent>
        </Card>
      )}

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
