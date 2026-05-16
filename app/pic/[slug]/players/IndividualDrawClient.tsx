"use client";

import { useState, useEffect, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, RotateCcw, Check, ArrowLeft, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { applyIndividualDraw } from "@/app/actions/pic";

interface Player { id: string; name: string }

const GROUP_COLOR = [
  "bg-blue-500/15 text-blue-600 border-blue-500/40",
  "bg-orange-500/15 text-orange-600 border-orange-500/40",
  "bg-emerald-500/15 text-emerald-600 border-emerald-500/40",
  "bg-pink-500/15 text-pink-600 border-pink-500/40",
  "bg-violet-500/15 text-violet-600 border-violet-500/40",
  "bg-amber-500/15 text-amber-600 border-amber-500/40",
];

const GROUP_SOLID = [
  "bg-blue-500 text-white",
  "bg-orange-500 text-white",
  "bg-emerald-500 text-white",
  "bg-pink-500 text-white",
  "bg-violet-500 text-white",
  "bg-amber-500 text-white",
];

const ANIM_DURATION = 2200;
const REVEAL_HOLD = 1400;

export default function IndividualDrawClient({
  eventId,
  players,
  groupSizes,
  advancePerGroup,
  onCancel,
}: {
  eventId: string;
  players: Player[];
  groupSizes: number[];
  advancePerGroup: number;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Each player → { g: groupIdx, p: slotPosition (1-indexed) }. Slot is random across all empty positions.
  const [assignments, setAssignments] = useState<Record<string, { g: number; p: number }>>({});
  const [drawing, setDrawing] = useState<{ player: Player; result: number | null; position: number | null } | null>(null);
  const [animTick, setAnimTick] = useState(0);
  const [progress, setProgress] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const groupCount = groupSizes.length;
  const storageKey = `pic-individual-draw-${eventId}`;

  // Restore on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        // New format: { pid: { g, p } }
        if (data && typeof data === "object" && !Array.isArray(data)) {
          const first = Object.values(data)[0];
          if (first && typeof first === "object" && "g" in first && "p" in first) {
            setAssignments(data as Record<string, { g: number; p: number }>);
          }
        }
      }
    } catch {}
  }, [storageKey]);

  // Persist
  useEffect(() => {
    if (Object.keys(assignments).length > 0)
      localStorage.setItem(storageKey, JSON.stringify(assignments));
  }, [storageKey, assignments]);

  // Cleanup intervals
  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (progRef.current) clearInterval(progRef.current);
  }, []);

  const groupCounts = useMemo(() => {
    const counts = Array(groupCount).fill(0);
    for (const v of Object.values(assignments)) counts[v.g]++;
    return counts;
  }, [assignments, groupCount]);

  const remaining = useMemo(
    () => players.filter((p) => !(p.id in assignments)),
    [players, assignments],
  );

  const allDone = remaining.length === 0 && players.length > 0;
  const drawnCount = players.length - remaining.length;

  const handlePress = (p: Player) => {
    if (drawing || pending || p.id in assignments) return;

    // Pick a random EMPTY slot across all groups (any g, p combination not yet occupied)
    const occupied = new Set<string>();
    for (const v of Object.values(assignments)) occupied.add(`${v.g}-${v.p}`);
    const available: { g: number; p: number }[] = [];
    for (let g = 0; g < groupCount; g++) {
      for (let pos = 1; pos <= groupSizes[g]!; pos++) {
        if (!occupied.has(`${g}-${pos}`)) available.push({ g, p: pos });
      }
    }
    if (available.length === 0) return;
    const chosen = available[Math.floor(Math.random() * available.length)]!;

    setDrawing({ player: p, result: null, position: null });
    setProgress(0);
    setAnimTick(0);
    const start = Date.now();
    tickRef.current = setInterval(() => setAnimTick((t) => t + 1), 80);
    progRef.current = setInterval(() => {
      setProgress(Math.min(99, ((Date.now() - start) / ANIM_DURATION) * 100));
    }, 50);

    setTimeout(() => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (progRef.current) clearInterval(progRef.current);
      setProgress(100);
      setDrawing({ player: p, result: chosen.g, position: chosen.p });
      setTimeout(() => {
        setAssignments((prev) => ({ ...prev, [p.id]: chosen }));
        setDrawing(null);
      }, REVEAL_HOLD);
    }, ANIM_DURATION);
  };

  const handleReset = () => {
    if (!confirm("Đặt lại toàn bộ kết quả bốc thăm?")) return;
    setAssignments({});
    localStorage.removeItem(storageKey);
  };

  const handleSave = () => {
    // Build groupSlots ordered by slot position (p), so seed in DB matches slot number
    const groupSlots: string[][] = groupSizes.map((size) => Array(size).fill(""));
    for (const [pid, v] of Object.entries(assignments)) {
      groupSlots[v.g]![v.p - 1] = pid;
    }

    startTransition(async () => {
      const res = await applyIndividualDraw(eventId, groupSlots, advancePerGroup);
      if ("error" in res) {
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
        return;
      }
      localStorage.removeItem(storageKey);
      toast({ title: "Đã chia bảng!", description: "Phân hạng A/B trong từng bảng để tạo lịch." });
      router.refresh();
    });
  };

  const byId = (id: string) => players.find((p) => p.id === id);

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Chia bảng cá nhân
            </CardTitle>
            <CardDescription>
              Mời từng VĐV bấm tên mình để bốc thăm vào bảng — {drawnCount}/{players.length} đã quay
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending || !!drawing}>
            <ArrowLeft className="size-3.5" />Quay lại
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Group capacity overview */}
        <div className={`grid gap-2 ${groupCount <= 2 ? "grid-cols-2" : groupCount <= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
          {groupSizes.map((size, gi) => {
            const c = groupCounts[gi];
            const full = c >= size;
            return (
              <div
                key={gi}
                className={`rounded-lg border-2 p-2.5 text-center transition-all ${
                  full ? "border-green-500/50 bg-green-500/5" : GROUP_COLOR[gi % GROUP_COLOR.length]
                }`}
              >
                <p className="text-xs font-semibold">Bảng {String.fromCharCode(65 + gi)}</p>
                <p className="font-mono text-lg font-bold">
                  {c}<span className="text-xs opacity-60">/{size}</span>
                </p>
              </div>
            );
          })}
        </div>

        {/* Drawing overlay */}
        {drawing && (
          <div className="rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-primary/5 p-6 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-lg font-bold">
              {drawing.result === null ? (
                <>
                  <span className="inline-block animate-spin">🎲</span>
                  <span className="animate-pulse text-primary">Đang quay cho {drawing.player.name}...</span>
                  <span className="inline-block animate-spin" style={{ animationDirection: "reverse" }}>🎰</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-5 text-yellow-500" />
                  <span className="text-primary">Kết quả</span>
                  <Sparkles className="size-5 text-yellow-500" />
                </>
              )}
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl border-2 border-primary/40 bg-background px-5 py-3 shadow-lg">
                <p className="text-xs text-muted-foreground">VĐV</p>
                <p className="text-xl font-bold text-primary">{drawing.player.name}</p>
              </div>

              {drawing.result === null ? (
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(groupCount, 4) }, (_, i) => {
                    const gi = (animTick + i) % groupCount;
                    return (
                      <div
                        key={i}
                        className={`flex size-14 items-center justify-center rounded-lg text-xl font-black shadow ${GROUP_SOLID[gi % GROUP_SOLID.length]}`}
                        style={{
                          transform: `rotate(${(animTick * 3 + i * 60) % 8 - 4}deg) scale(${0.9 + (animTick % 3) * 0.05})`,
                          transition: "transform 0.08s",
                        }}
                      >
                        {String.fromCharCode(65 + gi)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 max-w-[90vw]">
                  <div
                    className={`flex flex-col items-center justify-center rounded-2xl px-5 py-3 sm:px-6 sm:py-4 shadow-2xl animate-bounce ${GROUP_SOLID[drawing.result % GROUP_SOLID.length]}`}
                  >
                    <span className="text-xs font-bold opacity-80">VĐV {drawing.position}</span>
                    <span className="text-2xl sm:text-3xl font-black leading-tight">Bảng {String.fromCharCode(65 + drawing.result)}</span>
                  </div>
                </div>
              )}

              <p className="text-sm font-semibold">
                {drawing.result === null
                  ? "Đang xác định bảng..."
                  : <>🏆 Bạn là <strong>VĐV {drawing.position} - Bảng {String.fromCharCode(65 + drawing.result)}</strong>!</>}
              </p>
            </div>

            <div className="mx-auto h-2 max-w-xs overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Remaining players */}
        {!drawing && remaining.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Người chưa quay ({remaining.length}) — tap tên mình
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {remaining.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePress(p)}
                  disabled={pending}
                  className="group flex items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-card px-3 py-3 text-sm font-semibold transition-all hover:scale-105 hover:border-primary hover:bg-primary/10 hover:shadow-lg active:scale-95"
                >
                  <Shuffle className="mr-1.5 size-3.5 text-primary opacity-60 group-hover:rotate-180 transition-transform duration-500" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Group results */}
        {drawnCount > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kết quả ({drawnCount}/{players.length})
            </p>
            <div className={`grid gap-3 ${groupCount <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}>
              {groupSizes.map((size, gi) => {
                // Build fixed slot array (length=size). Each slot holds the player drawn into it (or null).
                const slots: (string | null)[] = Array(size).fill(null);
                for (const [pid, v] of Object.entries(assignments)) {
                  if (v.g === gi) slots[v.p - 1] = byId(pid)?.name ?? pid;
                }
                const filled = slots.filter((s) => s !== null).length;
                const letter = String.fromCharCode(65 + gi);
                return (
                  <div
                    key={gi}
                    className={`rounded-xl border-2 p-3 ${GROUP_COLOR[gi % GROUP_COLOR.length]}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-bold">Bảng {letter}</p>
                      <span className="font-mono text-xs opacity-70">{filled}/{size}</span>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {slots.map((name, i) => (
                        <li key={i} className={`flex items-center gap-1.5 ${name ? "" : "opacity-30"}`}>
                          <span className={`font-mono text-[10px] w-12 shrink-0 ${name ? "font-bold opacity-80" : ""}`}>VĐV {i + 1}</span>
                          {name ? (
                            <span className="truncate">{name}</span>
                          ) : (
                            <span className="text-xs italic">đang chờ...</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        {!drawing && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {drawnCount > 0 && !allDone && (
              <Button variant="outline" onClick={handleReset} disabled={pending} className="sm:flex-1">
                <RotateCcw className="size-3.5" />Đặt lại
              </Button>
            )}
            {allDone && (
              <>
                <Button variant="outline" onClick={handleReset} disabled={pending} className="sm:flex-1">
                  <RotateCcw className="size-3.5" />Quay lại từ đầu
                </Button>
                <Button onClick={handleSave} disabled={pending} size="lg" className="sm:flex-[2]">
                  <Trophy className="size-4" />
                  <Check className="size-4" />
                  {pending ? "Đang lưu..." : "Xác nhận & Lưu kết quả"}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
