"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTeamEvent } from "@/app/actions/team";
import { translateError } from "@/lib/error-messages";
import { CATEGORY_LABELS, type RubberCategory } from "@/lib/team/types";
import {
  MAX_RUBBERS,
  MAX_TEAM_SIZE,
  MIN_TEAM_SIZE,
  rosterRequirement,
} from "@/lib/team/validate";
import Link from "next/link";

const CATEGORY_ORDER: RubberCategory[] = ["MD", "WD", "XD", "FD"];
const SIZE_PRESETS = [4, 6, 8, 10];
const MAX_PER_CATEGORY = 4;

const CATEGORY_CHIP: Record<RubberCategory, string> = {
  MD: "bg-blue-500/15 text-blue-600",
  WD: "bg-pink-500/15 text-pink-600",
  XD: "bg-purple-500/15 text-purple-600",
  FD: "bg-muted text-muted-foreground",
};

export default function NewTeamClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("Giải đồng đội");
  const [sizePreset, setSizePreset] = useState<number | null>(6);
  const [customSize, setCustomSize] = useState("");
  const [counts, setCounts] = useState<Record<RubberCategory, number>>({
    MD: 1,
    WD: 1,
    XD: 1,
    FD: 0,
  });
  const [allowRepeatPlayer, setAllowRepeatPlayer] = useState(true);
  const [targetPoints, setTargetPoints] = useState(15);
  const [serverError, setServerError] = useState<string | null>(null);

  const teamSize = sizePreset ?? parseInt(customSize, 10);
  const teamSizeValid =
    Number.isInteger(teamSize) && teamSize >= MIN_TEAM_SIZE && teamSize <= MAX_TEAM_SIZE;

  const rubbers = useMemo(
    () => CATEGORY_ORDER.flatMap((cat) => Array<RubberCategory>(counts[cat]).fill(cat)),
    [counts],
  );
  const totalRubbers = rubbers.length;

  const req = useMemo(
    () =>
      rosterRequirement({
        teamSize: teamSizeValid ? teamSize : 6,
        rubbers,
        targetPoints,
        allowRepeatPlayer,
      }),
    [rubbers, allowRepeatPlayer, teamSize, teamSizeValid, targetPoints],
  );

  const minHint = useMemo(() => {
    if (totalRubbers === 0) return null;
    const parts: string[] = [];
    if (req.minM > 0) parts.push(`${req.minM} nam`);
    if (req.minF > 0) parts.push(`${req.minF} nữ`);
    if (parts.length === 0) return `Mỗi đội cần tối thiểu ${req.minTotal} VĐV`;
    let hint = `Mỗi đội cần tối thiểu ${parts.join(", ")}`;
    if (req.minTotal > req.minM + req.minF) hint += ` (tổng ≥ ${req.minTotal} VĐV)`;
    return hint;
  }, [req, totalRubbers]);

  const changeCount = (cat: RubberCategory, delta: number) => {
    setCounts((prev) => {
      const next = prev[cat] + delta;
      if (next < 0 || next > MAX_PER_CATEGORY) return prev;
      if (delta > 0 && totalRubbers >= MAX_RUBBERS) return prev;
      return { ...prev, [cat]: next };
    });
  };

  const canStart = name.trim().length >= 3 && totalRubbers >= 1 && teamSizeValid && !pending;

  const handleStart = () => {
    if (!canStart) return;
    setServerError(null);
    startTransition(async () => {
      const res = await createTeamEvent(name.trim(), {
        teamSize,
        rubbers,
        targetPoints,
        allowRepeatPlayer,
      });
      if ("error" in res) {
        setServerError(res.error);
      } else {
        router.push(`/team/${res.slug}/squads`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          <Link href="/dashboard" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
            <ChevronLeft className="size-5" />
          </Link>
          <span className="font-semibold">Tạo giải đồng đội</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
        {serverError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Lỗi: {translateError(serverError)}
          </div>
        )}

        <section className="space-y-2">
          <label className="text-sm font-semibold">Tên giải đấu</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-primary/50 focus:ring-2"
          />
        </section>

        <section className="space-y-2">
          <label className="text-sm font-semibold">Số VĐV mỗi đội</label>
          <div className="flex gap-1">
            {SIZE_PRESETS.map((v) => (
              <button key={v} onClick={() => setSizePreset(v)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                  sizePreset === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                }`}>
                {v}
              </button>
            ))}
            <button onClick={() => setSizePreset(null)}
              className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                sizePreset === null ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
              }`}>
              Khác
            </button>
          </div>
          {sizePreset === null && (
            <input
              type="number"
              min={MIN_TEAM_SIZE}
              max={MAX_TEAM_SIZE}
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              placeholder={`${MIN_TEAM_SIZE}–${MAX_TEAM_SIZE}`}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-primary/50 focus:ring-2"
            />
          )}
        </section>

        <section className="space-y-2">
          <label className="text-sm font-semibold">Nội dung mỗi trận đối đầu</label>
          <div className="divide-y rounded-lg border bg-card">
            {CATEGORY_ORDER.map((cat) => (
              <div key={cat} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm font-medium">{CATEGORY_LABELS[cat]}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeCount(cat, -1)} disabled={counts[cat] === 0}
                    className="flex size-8 items-center justify-center rounded-md border text-lg font-semibold transition-colors hover:border-primary/50 disabled:opacity-40">
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">{counts[cat]}</span>
                  <button onClick={() => changeCount(cat, 1)}
                    disabled={counts[cat] >= MAX_PER_CATEGORY || totalRubbers >= MAX_RUBBERS}
                    className="flex size-8 items-center justify-center rounded-md border text-lg font-semibold transition-colors hover:border-primary/50 disabled:opacity-40">
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          {totalRubbers > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {rubbers.map((cat, i) => (
                <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_CHIP[cat]}`}>
                  {i + 1}. {CATEGORY_LABELS[cat]}
                </span>
              ))}
            </div>
          )}
          {minHint && <p className="text-xs text-muted-foreground">{minHint}</p>}
          {totalRubbers === 0 && (
            <p className="text-xs text-destructive">Chọn ít nhất 1 nội dung thi đấu</p>
          )}
          {totalRubbers > 0 && totalRubbers % 2 === 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Số chẵn: nếu hòa trận nhỏ sẽ phân định bằng hiệu số điểm — nên chọn số lẻ
            </div>
          )}
        </section>

        <section>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card p-3">
            <div>
              <p className="text-sm font-medium">Cho phép 1 VĐV đánh nhiều nội dung trong 1 trận đối đầu</p>
              <p className="text-xs text-muted-foreground">Tắt: mỗi VĐV chỉ đánh 1 nội dung — cần nhiều VĐV hơn</p>
            </div>
            <div onClick={() => setAllowRepeatPlayer((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${allowRepeatPlayer ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${allowRepeatPlayer ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </label>
        </section>

        <section className="space-y-2">
          <label className="text-sm font-semibold">Điểm mỗi trận — chạm</label>
          <div className="flex gap-1">
            {[11, 15, 21].map((v) => (
              <button key={v} onClick={() => setTargetPoints(v)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                  targetPoints === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                }`}>
                {v}
              </button>
            ))}
          </div>
        </section>

        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground">
          Sau khi tạo, bạn sẽ thêm đội và VĐV ở bước tiếp theo.
        </div>

        <Button onClick={handleStart} size="lg" className="w-full" disabled={!canStart}>
          {pending ? "Đang tạo…" : "Tạo giải đấu →"}
        </Button>
      </main>
    </div>
  );
}
