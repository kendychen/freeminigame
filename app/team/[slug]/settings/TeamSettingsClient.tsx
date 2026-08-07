"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { updateTeamConfig, resetTeamSchedule } from "@/app/actions/team";
import { translateError } from "@/lib/error-messages";
import { CATEGORY_LABELS } from "@/lib/team/types";
import type { RubberCategory, TeamConfig, TeamEventFull } from "@/lib/team/types";
import { MAX_RUBBERS, MAX_TEAM_SIZE, MIN_TEAM_SIZE, validateTeamConfig } from "@/lib/team/validate";

const CATEGORY_ORDER: RubberCategory[] = ["MD", "WD", "XD", "FD"];

const CATEGORY_HINTS: Record<RubberCategory, string> = {
  MD: "2 nam vs 2 nam",
  WD: "2 nữ vs 2 nữ",
  XD: "1 nam + 1 nữ mỗi bên",
  FD: "Ghép tự do",
};

export default function TeamSettingsClient({ state }: { state: TeamEventFull }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const { event, ties, rubbers: eventRubbers } = state;
  const config = event.config;
  const hasSchedule = ties.length > 0;
  const hasScored = eventRubbers.some((r) => r.status !== "pending");

  const [name, setName] = useState(event.name);
  const [teamSize, setTeamSize] = useState(config.teamSize);
  const [targetPoints, setTargetPoints] = useState(config.targetPoints);
  const [allowRepeatPlayer, setAllowRepeatPlayer] = useState(config.allowRepeatPlayer);
  const [counts, setCounts] = useState<Record<RubberCategory, number>>(() => {
    const c: Record<RubberCategory, number> = { MD: 0, WD: 0, XD: 0, FD: 0 };
    for (const r of config.rubbers) c[r] += 1;
    return c;
  });
  const [armedReset, setArmedReset] = useState(false);

  useEffect(() => {
    if (!armedReset) return;
    const t = setTimeout(() => setArmedReset(false), 4000);
    return () => clearTimeout(t);
  }, [armedReset]);

  const rubbers = hasSchedule
    ? config.rubbers
    : CATEGORY_ORDER.flatMap((cat) => Array.from({ length: counts[cat] }, () => cat));
  const total = rubbers.length;

  const step = (cat: RubberCategory, delta: number) =>
    setCounts((prev) => ({ ...prev, [cat]: Math.max(0, Math.min(4, prev[cat] + delta)) }));

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: "Lỗi", description: "Tên không được để trống", variant: "destructive" });
      return;
    }
    const merged: TeamConfig = { teamSize, rubbers, targetPoints, allowRepeatPlayer };
    const cfgErr = validateTeamConfig(merged);
    if (cfgErr) {
      toast({ title: "Lỗi", description: cfgErr.message, variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const patch: Partial<TeamConfig> & { name?: string } = {
        name: trimmed,
        teamSize,
        targetPoints,
        allowRepeatPlayer,
      };
      if (!hasSchedule) {
        patch.rubbers = rubbers;
      }
      const res = await updateTeamConfig(event.id, patch);
      if ("error" in res) {
        toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
      } else {
        toast({ title: "Đã lưu cài đặt" });
        router.refresh();
      }
    });
  };

  const onReset = () => {
    if (!armedReset) {
      setArmedReset(true);
      return;
    }
    setArmedReset(false);
    startTransition(async () => {
      const res = await resetTeamSchedule(event.id);
      if ("error" in res) {
        toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
      } else {
        toast({ title: "Đã đặt lại lịch đấu" });
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
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Điểm mỗi trận</CardTitle>
          <CardDescription>Số điểm để kết thúc một nội dung đôi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1.5">
            {[11, 15, 21].map((v) => (
              <button key={v} onClick={() => setTargetPoints(v)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                  targetPoints === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                }`}>
                {v}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Số VĐV mỗi đội</CardTitle>
          <CardDescription>
            Định hướng quân số, từ {MIN_TEAM_SIZE} đến {MAX_TEAM_SIZE} — không chặn thêm/bớt VĐV
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input type="number" min={MIN_TEAM_SIZE} max={MAX_TEAM_SIZE} value={teamSize}
            onChange={(e) => setTeamSize(parseInt(e.target.value) || 0)}
            className="w-20 rounded-md border bg-background px-2 py-1.5 text-center font-mono text-sm font-bold"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nội dung mỗi trận đối đầu</CardTitle>
          <CardDescription>
            {hasSchedule
              ? "Đã tạo lịch thi đấu — nội dung bị khóa. Đặt lại lịch đấu để chỉnh sửa."
              : `Thứ tự đánh theo thứ tự bên dưới, tối đa ${MAX_RUBBERS} nội dung`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasSchedule && (
            <div className="space-y-2.5">
              {CATEGORY_ORDER.map((cat) => (
                <div key={cat} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{CATEGORY_LABELS[cat]}</p>
                    <p className="text-xs text-muted-foreground">{CATEGORY_HINTS[cat]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => step(cat, -1)} disabled={counts[cat] === 0 || pending}
                      className="flex size-8 items-center justify-center rounded-lg border transition-colors hover:border-primary/50 disabled:opacity-40">
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-6 text-center font-mono text-sm font-bold">{counts[cat]}</span>
                    <button onClick={() => step(cat, 1)}
                      disabled={counts[cat] >= 4 || total >= MAX_RUBBERS || pending}
                      className="flex size-8 items-center justify-center rounded-lg border transition-colors hover:border-primary/50 disabled:opacity-40">
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {total > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {rubbers.map((cat, i) => (
                <span key={i} className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-medium">
                  {i + 1}. {CATEGORY_LABELS[cat]}
                </span>
              ))}
            </div>
          )}
          {!hasSchedule && total > 0 && total % 2 === 0 && (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
              Số chẵn có thể hòa — nên chọn số lẻ để tránh hòa
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tuỳ chọn</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-center justify-between">
            <div>
              <p className="text-sm font-medium">Cho phép đánh lặp nội dung</p>
              <p className="text-xs text-muted-foreground">
                1 VĐV được đánh nhiều nội dung trong 1 trận đối đầu
                {hasSchedule && " — áp dụng khi xếp đội hình mới"}
              </p>
            </div>
            <div onClick={() => setAllowRepeatPlayer((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${allowRepeatPlayer ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${allowRepeatPlayer ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </label>
        </CardContent>
      </Card>

      <Button onClick={save} size="lg" className="w-full" disabled={pending}>
        Lưu cài đặt
      </Button>

      {hasSchedule && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Vùng nguy hiểm</CardTitle>
            <CardDescription>
              {hasScored
                ? "Đã có trận hoàn thành — không thể đặt lại lịch đấu"
                : "Xóa toàn bộ lịch đối đầu và quay về bước thiết lập đội"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={onReset} disabled={pending || hasScored}>
              <RefreshCw className="size-4" />
              {armedReset ? "Chạm lần nữa để xác nhận" : "Đặt lại lịch đấu"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
