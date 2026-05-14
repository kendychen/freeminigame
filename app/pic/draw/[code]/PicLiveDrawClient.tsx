"use client";

import { useState, useEffect, useTransition, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, Sparkles, Trophy, Check, Lock, Radio, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  tapPicIndividualDraw,
  applyPicIndividualDrawSession,
  resetPicIndividualDrawPlayer,
  resetPicIndividualDrawAssignments,
} from "@/app/actions/pic";
import { getSupabaseBrowser } from "@/lib/supabase/client";

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

export default function PicLiveDrawClient({
  code,
  eventName,
  ownerId,
  players,
  groupSizes,
  initialAssignments,
  initialStatus,
  lockedPlayerId,
  playerToken,
}: {
  code: string;
  eventName: string;
  ownerId: string;
  players: Player[];
  groupSizes: number[];
  initialAssignments: Record<string, { g: number; p: number }>;
  initialStatus: string;
  lockedPlayerId: string | null;
  playerToken: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [status, setStatus] = useState(initialStatus);
  const [animating, setAnimating] = useState<{ player: Player; result: number | null; position: number | null } | null>(null);
  const [animTick, setAnimTick] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const lastAssignmentsRef = useRef(initialAssignments);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const groupCount = groupSizes.length;
  const playerMap = useMemo(() => {
    const m: Record<string, Player> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const lockedPlayer = lockedPlayerId ? playerMap[lockedPlayerId] : null;

  // Detect owner via local check (server validates on apply/reset)
  useEffect(() => {
    const sb = getSupabaseBrowser();
    void sb.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (data.user && data.user.id === ownerId) setIsOwner(true);
    });
  }, [ownerId]);

  // Realtime subscription
  useEffect(() => {
    const sb = getSupabaseBrowser();
    const ch = sb
      .channel(`pic-indiv:${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pic_individual_sessions",
          filter: `code=eq.${code}`,
        },
        (payload: { new: { assignments: Record<string, { g: number; p: number }>; status: string } }) => {
          const newA = payload.new.assignments;
          const newStatus = payload.new.status;
          setStatus(newStatus);

          // Detect newly-added assignment → trigger animation
          const prev = lastAssignmentsRef.current;
          let newPid: string | null = null;
          for (const pid of Object.keys(newA)) {
            if (!(pid in prev)) { newPid = pid; break; }
          }
          lastAssignmentsRef.current = newA;

          const p = newPid ? playerMap[newPid] : undefined;
          if (newPid && p) {
            const slot = newA[newPid]!;
            triggerAnimation(p, slot.g, slot.p, () => {
              setAssignments(newA);
            });
          } else {
            setAssignments(newA);
          }
        },
      )
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, playerMap]);

  // Cleanup intervals on unmount
  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (progRef.current) clearInterval(progRef.current);
  }, []);

  const triggerAnimation = (p: Player, result: number, position: number, onDone: () => void) => {
    setAnimating({ player: p, result: null, position: null });
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
      setAnimating({ player: p, result, position });
      setTimeout(() => {
        setAnimating(null);
        onDone();
      }, REVEAL_HOLD);
    }, ANIM_DURATION);
  };

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
    if (animating || pending || p.id in assignments) return;
    if (lockedPlayerId && p.id !== lockedPlayerId) {
      toast({ title: "Bạn chỉ được bấm tên mình", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const res = await tapPicIndividualDraw(code, p.id, playerToken);
      if ("error" in res) {
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
      }
      // Realtime will deliver the result + trigger animation
    });
  };

  const handleApply = () => {
    startTransition(async () => {
      const res = await applyPicIndividualDrawSession(code);
      if ("error" in res) {
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Đã lưu kết quả!", description: "Quay về trang quản lý..." });
      router.refresh();
    });
  };

  const handleResetPlayer = (p: Player) => {
    if (!confirm(`Quay lại lượt của ${p.name}? Họ sẽ phải bốc thăm lại.`)) return;
    startTransition(async () => {
      const res = await resetPicIndividualDrawPlayer(code, p.id);
      if ("error" in res) {
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
        return;
      }
      // Realtime will sync the change
    });
  };

  const handleResetAll = () => {
    if (!confirm("Xoá toàn bộ kết quả bốc thăm? Tất cả VĐV sẽ phải quay lại từ đầu.")) return;
    startTransition(async () => {
      const res = await resetPicIndividualDrawAssignments(code);
      if ("error" in res) {
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Đã đặt lại toàn bộ" });
    });
  };

  if (status === "applied") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 pt-12 text-center">
        <Trophy className="mx-auto size-16 text-yellow-500" />
        <h1 className="text-2xl font-bold">Bốc thăm đã hoàn tất!</h1>
        <p className="text-muted-foreground">Admin đã lưu kết quả. Đợi lịch thi đấu được tạo.</p>
        <div className={`grid gap-3 ${groupCount <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}>
          {groupSizes.map((size, gi) => {
            const slots: (string | null)[] = Array(size).fill(null);
            for (const [pid, v] of Object.entries(assignments)) {
              if (v.g === gi) slots[v.p - 1] = playerMap[pid]?.name ?? pid;
            }
            const filled = slots.filter((s) => s !== null).length;
            return (
              <div key={gi} className={`rounded-xl border-2 p-3 text-left ${GROUP_COLOR[gi % GROUP_COLOR.length]}`}>
                <p className="font-bold">Bảng {String.fromCharCode(65 + gi)}</p>
                <p className="text-xs opacity-70">{filled}/{size}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {slots.map((name, i) => (
                    <li key={i} className={name ? "" : "opacity-40"}>
                      <span className="font-mono text-[10px] font-bold mr-1.5">VĐV {i + 1}</span>
                      {name ?? <em className="text-xs">đang chờ...</em>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="mx-auto max-w-md space-y-3 p-4 pt-12 text-center">
        <Lock className="mx-auto size-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Phiên bốc thăm đã hủy</h1>
        <p className="text-sm text-muted-foreground">Phiên này không còn hoạt động.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-4">
      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider text-red-500">
          <Radio className="size-3.5 animate-pulse" />LIVE
        </div>
        <h1 className="text-xl font-bold sm:text-2xl">🎲 {eventName}</h1>
        <p className="text-xs text-muted-foreground">
          {drawnCount}/{players.length} đã quay
          {lockedPlayer && <> · Bạn là <strong className="text-primary">{lockedPlayer.name}</strong></>}
        </p>
      </div>

      {/* Group capacity */}
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

      {/* Animation overlay */}
      {animating && (
        <div className="rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-primary/5 p-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-lg font-bold">
            {animating.result === null ? (
              <>
                <span className="inline-block animate-spin">🎲</span>
                <span className="animate-pulse text-primary">Đang quay cho {animating.player.name}...</span>
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
              <p className="text-xl font-bold text-primary">{animating.player.name}</p>
            </div>
            {animating.result === null ? (
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
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`flex flex-col items-center justify-center rounded-2xl px-6 py-4 shadow-2xl animate-bounce ${GROUP_SOLID[animating.result % GROUP_SOLID.length]}`}
                >
                  <span className="text-xs font-bold opacity-80">VĐV {animating.position}</span>
                  <span className="text-3xl font-black leading-tight">Bảng {String.fromCharCode(65 + animating.result)}</span>
                </div>
              </div>
            )}
            <p className="text-sm font-semibold">
              {animating.result === null
                ? "Đang xác định bảng..."
                : <>🏆 Bạn là <strong>VĐV {animating.position} - Bảng {String.fromCharCode(65 + animating.result)}</strong>!</>}
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

      {/* Remaining list */}
      {!animating && remaining.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {lockedPlayer ? "Bấm tên bạn để quay" : `Người chưa quay (${remaining.length})`}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {remaining.map((p) => {
              const isLocked = lockedPlayerId && p.id !== lockedPlayerId;
              const isMine = lockedPlayerId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handlePress(p)}
                  disabled={pending || isLocked || !!animating}
                  className={`group flex items-center justify-center rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all active:scale-95 ${
                    isLocked
                      ? "cursor-not-allowed border-muted bg-muted/30 opacity-50"
                      : isMine
                      ? "border-primary bg-primary/10 text-primary hover:scale-105 hover:shadow-lg animate-pulse"
                      : "border-dashed border-primary/40 bg-card hover:scale-105 hover:border-primary hover:bg-primary/10 hover:shadow-lg"
                  }`}
                >
                  {isLocked ? <Lock className="mr-1.5 size-3.5" /> : (
                    <Shuffle className="mr-1.5 size-3.5 text-primary opacity-60 group-hover:rotate-180 transition-transform duration-500" />
                  )}
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Results so far */}
      {drawnCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kết quả ({drawnCount}/{players.length})
            </p>
            {isOwner && (
              <button
                onClick={handleResetAll}
                disabled={pending || !!animating}
                className="flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
              >
                <RotateCcw className="size-3" />Đặt lại tất cả
              </button>
            )}
          </div>
          <div className={`grid gap-3 ${groupCount <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}>
            {groupSizes.map((size, gi) => {
              const slots: { pid: string; name: string }[] = [];
              const slotArr: ({ pid: string; name: string } | null)[] = Array(size).fill(null);
              for (const [pid, v] of Object.entries(assignments)) {
                if (v.g === gi) {
                  slotArr[v.p - 1] = { pid, name: playerMap[pid]?.name ?? pid };
                }
              }
              for (const s of slotArr) if (s) slots.push(s);
              return (
                <div key={gi} className={`rounded-xl border-2 p-3 ${GROUP_COLOR[gi % GROUP_COLOR.length]}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-bold">Bảng {String.fromCharCode(65 + gi)}</p>
                    <span className="font-mono text-xs opacity-70">{slots.length}/{size}</span>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {slotArr.map((entry, i) => (
                      <li key={i} className={`group flex items-center gap-1.5 ${entry ? "" : "opacity-40"}`}>
                        <span className="font-mono text-[10px] font-bold w-12 shrink-0">VĐV {i + 1}</span>
                        {entry ? (
                          <>
                            <span className="truncate flex-1">{entry.name}</span>
                            {isOwner && (
                              <button
                                onClick={() => handleResetPlayer({ id: entry.pid, name: entry.name })}
                                disabled={pending || !!animating}
                                title="Quay lại lượt của VĐV này"
                                className="flex size-5 shrink-0 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-current/10 transition-opacity"
                              >
                                <X className="size-3" />
                              </button>
                            )}
                          </>
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
          {isOwner && (
            <p className="text-[11px] text-muted-foreground">
              👑 Bạn là admin — hover vào tên VĐV → nhấn <X className="inline size-2.5" /> để cho họ quay lại.
            </p>
          )}
        </div>
      )}

      {/* Owner apply button */}
      {allDone && isOwner && !animating && (
        <Button onClick={handleApply} disabled={pending} size="lg" className="w-full">
          <Trophy className="size-4" /><Check className="size-4" />
          {pending ? "Đang lưu..." : "✅ Xác nhận & Lưu kết quả"}
        </Button>
      )}
    </div>
  );
}
