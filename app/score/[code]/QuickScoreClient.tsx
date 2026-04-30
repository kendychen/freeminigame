"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Link2,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Trophy,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface QuickScore {
  code: string;
  team_a_name: string;
  team_b_name: string;
  score_a: number;
  score_b: number;
  status: "pending" | "live" | "completed";
  winner: "a" | "b" | null;
  target_points: number | null;
  title: string | null;
  updated_at: string;
}

export function QuickScoreClient({ initial }: { initial: QuickScore }) {
  const [score, setScore] = useState<QuickScore>(initial);
  const [pending, start] = useTransition();
  const [armedFinalize, setArmedFinalize] = useState(false);
  const channelKey = `quick-score:${initial.code}:${Math.random().toString(36).slice(2, 6)}`;

  // Subscribe via postgres_changes
  useEffect(() => {
    const sb = getSupabaseBrowser();
    const ch = sb
      .channel(channelKey)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "quick_scores",
          filter: `code=eq.${initial.code}`,
        },
        (payload: { new: QuickScore }) => {
          setScore(payload.new);
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [initial.code, channelKey]);

  // Wake-lock + arm timeout
  useEffect(() => {
    interface Sentinel { release(): Promise<void> }
    let lock: Sentinel | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
    };
    const acquire = () => {
      nav.wakeLock?.request("screen").then((l) => { lock = l }).catch(() => {});
    };
    if (nav.wakeLock) acquire();
    const onVis = () => {
      if (document.visibilityState === "visible" && !lock) acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!armedFinalize) return;
    const t = setTimeout(() => setArmedFinalize(false), 4000);
    return () => clearTimeout(t);
  }, [armedFinalize]);

  const apply = async (patch: Partial<QuickScore>) => {
    const sb = getSupabaseBrowser();
    const { error } = await sb
      .from("quick_scores")
      .update(patch)
      .eq("code", initial.code);
    if (error) {
      toast({
        title: "Lỗi lưu",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const bump = (side: "a" | "b", delta: number) => {
    if (score.status === "completed" && delta > 0) {
      toast({
        title: "Trận đã kết thúc",
        description: "Mở lại trước khi tăng điểm.",
      });
      return;
    }
    const nextA = Math.max(0, score.score_a + (side === "a" ? delta : 0));
    const nextB = Math.max(0, score.score_b + (side === "b" ? delta : 0));
    const wasCompleted = score.status === "completed";
    const status = wasCompleted
      ? "completed"
      : nextA + nextB > 0
        ? "live"
        : "pending";
    setScore({ ...score, score_a: nextA, score_b: nextB, status });
    start(() => {
      void apply({ score_a: nextA, score_b: nextB, status });
    });
  };

  const reset = () => {
    if (!confirm("Reset 0-0?")) return;
    setScore({
      ...score,
      score_a: 0,
      score_b: 0,
      status: "pending",
      winner: null,
    });
    start(() => {
      void apply({ score_a: 0, score_b: 0, status: "pending", winner: null });
    });
  };

  const finalize = () => {
    if (score.score_a === score.score_b) {
      toast({
        title: "Đang hoà",
        description: "Cần chênh điểm.",
        variant: "destructive",
      });
      return;
    }
    if (!armedFinalize) {
      setArmedFinalize(true);
      toast({
        title: "Bấm lần nữa để xác nhận",
        description: `Kết thúc với tỉ số ${score.score_a} - ${score.score_b}`,
      });
      return;
    }
    setArmedFinalize(false);
    const winner: "a" | "b" =
      score.score_a > score.score_b ? "a" : "b";
    setScore({ ...score, status: "completed", winner });
    start(() => {
      void apply({ status: "completed", winner });
      toast({ title: "Đã kết thúc trận" });
    });
  };

  const reopen = () => {
    const status =
      score.score_a + score.score_b > 0 ? "live" : "pending";
    setScore({ ...score, status, winner: null });
    start(() => {
      void apply({ status, winner: null });
      toast({ title: "Đã mở lại" });
    });
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/score/${initial.code}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Đã copy link", description: url });
    } catch {
      prompt("Sao chép link:", url);
    }
  };

  const requestFullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };

  const winnerSide =
    score.status === "completed" ? score.winner : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header
        className="flex items-center justify-between border-b px-3 py-2 sm:px-4 sm:py-3"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <a
          href="/"
          className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <ArrowLeft className="size-3.5" />
          Thoát
        </a>
        <div className="flex flex-1 items-center justify-center gap-2 px-2 text-center text-xs sm:text-sm">
          {score.title ? (
            <span className="truncate font-medium">{score.title}</span>
          ) : (
            <span className="font-medium">Tỷ số nhanh</span>
          )}
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            Mã <code className="font-mono">{initial.code}</code>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyLink}
            className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
            title="Copy link share"
          >
            <Link2 className="size-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <button
            onClick={requestFullscreen}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Toàn màn hình"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex items-center justify-center gap-2 py-1 text-[11px] uppercase tracking-wider">
        {score.status === "live" && (
          <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 font-semibold text-red-500">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
            LIVE
          </span>
        )}
        {score.status === "completed" && (
          <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
            <Trophy className="size-3" /> Kết thúc
          </span>
        )}
        {score.status === "pending" && (
          <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
            Chưa bắt đầu
          </span>
        )}
        {score.target_points && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
            Tới {score.target_points}
          </span>
        )}
        {pending && (
          <span className="text-muted-foreground">Đang lưu…</span>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 sm:grid-cols-2">
        <Pane
          side="a"
          name={score.team_a_name}
          value={score.score_a}
          isWinner={winnerSide === "a"}
          onPlus={() => bump("a", 1)}
          onMinus={() => bump("a", -1)}
        />
        <Pane
          side="b"
          name={score.team_b_name}
          value={score.score_b}
          isWinner={winnerSide === "b"}
          onPlus={() => bump("b", 1)}
          onMinus={() => bump("b", -1)}
        />
      </div>

      <footer
        className="border-t bg-card/50 px-3 py-2.5 sm:px-4 sm:py-3"
        style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            disabled={pending}
          >
            <RotateCcw className="size-4" />
            Reset 0-0
          </Button>
          {score.status !== "completed" && (
            <Button
              size="sm"
              variant={armedFinalize ? "destructive" : "default"}
              onClick={finalize}
              disabled={pending || score.score_a === score.score_b}
            >
              <CheckCircle2 className="size-4" />
              {armedFinalize ? "Bấm lần nữa để xác nhận" : "Kết thúc trận"}
            </Button>
          )}
          {score.status === "completed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={reopen}
              disabled={pending}
            >
              <Undo2 className="size-4" />
              Mở lại
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function Pane({
  side,
  name,
  value,
  isWinner,
  onPlus,
  onMinus,
}: {
  side: "a" | "b";
  name: string;
  value: number;
  isWinner: boolean;
  onPlus: () => void;
  onMinus: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-between gap-3 border-b p-4 sm:border-b-0 ${
        side === "a" ? "sm:border-r" : ""
      } ${isWinner ? "bg-primary/5" : ""}`}
    >
      <div className="flex w-full items-center justify-center gap-2 text-center">
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            side === "a"
              ? "bg-blue-500/15 text-blue-500"
              : "bg-orange-500/15 text-orange-500"
          }`}
        >
          {side.toUpperCase()}
        </span>
        <span className="line-clamp-2 break-words text-base font-bold sm:text-xl">
          {name}
        </span>
        {isWinner && <Trophy className="size-5 shrink-0 text-primary" />}
      </div>
      <div
        className={`flex-1 select-none text-center font-mono font-black tabular-nums ${
          isWinner ? "text-primary" : ""
        }`}
        style={{ fontSize: "clamp(96px, 22vw, 220px)", lineHeight: 1 }}
      >
        {value}
      </div>
      <div className="flex w-full max-w-sm items-center justify-center gap-3">
        <button
          onClick={onMinus}
          disabled={value <= 0}
          className="flex size-16 items-center justify-center rounded-2xl border-2 border-border bg-background text-foreground transition-all active:scale-95 disabled:opacity-40 sm:size-20"
          aria-label="Giảm 1"
        >
          <Minus className="size-7 sm:size-8" />
        </button>
        <button
          onClick={onPlus}
          className="flex h-16 flex-1 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg transition-all active:scale-95 sm:h-20 sm:text-3xl"
          aria-label="Tăng 1"
        >
          <Plus className="mr-1 size-7 sm:size-8" />
          +1
        </button>
      </div>
    </div>
  );
}
