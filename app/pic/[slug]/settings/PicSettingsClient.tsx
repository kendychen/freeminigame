"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { updatePicConfig } from "@/app/actions/pic";
import type { PicEventFull } from "@/app/actions/pic";

const WIN_PRESETS = [
  { w: 2, l: 0, label: "2 / 0", desc: "Phổ biến Pickleball" },
  { w: 3, l: 0, label: "3 / 0", desc: "Kiểu bóng đá" },
  { w: 3, l: 1, label: "3 / 1", desc: "Có điểm thua" },
  { w: 1, l: 0, label: "1 / 0", desc: "Chỉ đếm thắng" },
];

export default function PicSettingsClient({ state }: { state: PicEventFull }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const { id, config } = state;
  const [name, setName] = useState(config.name);
  const [targetGroup, setTargetGroup] = useState(config.targetGroup);
  const [targetKnockout, setTargetKnockout] = useState(config.targetKnockout);
  const [hasThirdPlace, setHasThirdPlace] = useState(config.hasThirdPlace);
  const [pointsForWin, setPointsForWin] = useState(config.pointsForWin ?? 2);
  const [pointsForLoss, setPointsForLoss] = useState(config.pointsForLoss ?? 0);

  const save = () => {
    startTransition(async () => {
      const res = await updatePicConfig(id, {
        name: name.trim(),
        targetGroup,
        targetKnockout,
        hasThirdPlace,
        pointsForWin,
        pointsForLoss,
      });
      if ("error" in res) {
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Đã lưu cài đặt" });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-5 max-w-xl">

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tên giải đấu</CardTitle>
        </CardHeader>
        <CardContent>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Điểm chạm</CardTitle>
          <CardDescription>Số điểm để kết thúc một trận</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Vòng bảng</p>
            <div className="flex gap-1.5">
              {[9, 11, 15, 21].map((v) => (
                <button key={v} onClick={() => setTargetGroup(v)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                    targetGroup === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                  }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Vòng knockout / Chung kết</p>
            <div className="flex gap-1.5">
              {[11, 15, 21].map((v) => (
                <button key={v} onClick={() => setTargetKnockout(v)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                    targetKnockout === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                  }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hệ số tính điểm bảng</CardTitle>
          <CardDescription>
            Điểm xếp hạng khi thắng / thua — dùng để sắp xếp bảng đấu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {WIN_PRESETS.map((p) => {
              const active = pointsForWin === p.w && pointsForLoss === p.l;
              return (
                <button key={p.label}
                  onClick={() => { setPointsForWin(p.w); setPointsForLoss(p.l); }}
                  className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${
                    active ? "border-primary bg-primary/10" : "hover:border-primary/50"
                  }`}>
                  <p className={`text-sm font-bold ${active ? "text-primary" : ""}`}>
                    Thắng +{p.w} / Thua +{p.l}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Thắng</span>
              <input type="number" min={0} max={99} value={pointsForWin}
                onChange={(e) => setPointsForWin(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-14 rounded-md border bg-background px-2 py-1 text-center font-mono text-sm font-bold"
              />
            </div>
            <span className="text-muted-foreground">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Thua</span>
              <input type="number" min={0} max={99} value={pointsForLoss}
                onChange={(e) => setPointsForLoss(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-14 rounded-md border bg-background px-2 py-1 text-center font-mono text-sm font-bold"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Thứ tự xếp hạng: Điểm → Hiệu số → Số thắng → Tên A–Z
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tuỳ chọn</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-center justify-between">
            <div>
              <p className="text-sm font-medium">Tranh hạng 3 – 4</p>
              <p className="text-xs text-muted-foreground">Thêm trận tranh huy chương đồng</p>
            </div>
            <div onClick={() => setHasThirdPlace((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${hasThirdPlace ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${hasThirdPlace ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </label>
        </CardContent>
      </Card>

      <Button onClick={save} size="lg" className="w-full">
        Lưu cài đặt
      </Button>
    </div>
  );
}
