"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Trophy,
  CheckCircle2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";
import type { DbMatch } from "@/types/database";

export interface BoardTeamLite {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface RefereeBoardProps {
  match: DbMatch;
  teams: BoardTeamLite[];
  tournamentName: string;
  /** Optional small subtitle next to tournament name. */
  subtitle?: string;
  /** Where the back/exit button leads. Pass null to hide it (anonymous). */
  exitHref?: string | null;
  /** Optional element rendered in the header right slot (eg. share button). */
  headerExtra?: React.ReactNode;
  /** Optional: legacy fire-and-forget per-tap save. Most callers should leave
   *  this undefined — score is local until Kết thúc lưu một phát. */
  onIncrement?: (side: "a" | "b", delta: number) => Promise<{ error?: string }>;
  /** Local reset by default; if provided, also called for server-side cleanup. */
  onReset?: () => Promise<{ error?: string }>;
  /** Finalize: receives the FINAL scores. Saves once + declares winner. */
  onFinalize?: (
    scoreA: number,
    scoreB: number,
  ) => Promise<{ error?: string }>;
  /** Reopen a completed match for re-scoring (server resets winner). */
  onReopen?: () => Promise<{ error?: string }>;
  /** Optional team-id → member display names. Shown under each team name. */
  membersByTeam?: Record<string, string[]>;
}

export function RefereeBoard({
  match,
  teams,
  tournamentName,
  subtitle,
  exitHref,
  headerExtra,
  onIncrement,
  onReset,
  onFinalize,
  onReopen,
  membersByTeam,
}: RefereeBoardProps) {
  const [pending, start] = useTransition();
  // Local-first: scores live in component state. localStorage backup so a
  // refresh / accidental tab close mid-match doesn't lose progress.
  const lsKey = `ref-score:${match.id}`;
  const isCompleted = match.status === "completed";
  const [scoreA, setScoreA] = useState<number>(match.score_a);
  const [scoreB, setScoreB] = useState<number>(match.score_b);

  // On mount: if completed → DB wins; else if localStorage has scores, restore
  useEffect(() => {
    if (isCompleted) return;
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return;
      const v = JSON.parse(raw) as { a: number; b: number };
      if (typeof v.a === "number" && typeof v.b === "number") {
        setScoreA(v.a);
        setScoreB(v.b);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  // Persist to localStorage on every change
  useEffect(() => {
    if (isCompleted) return;
    try {
      localStorage.setItem(lsKey, JSON.stringify({ a: scoreA, b: scoreB }));
    } catch {
      /* ignore */
    }
  }, [scoreA, scoreB, isCompleted, lsKey]);

  // When match completes (final saved), drop the local backup
  useEffect(() => {
    if (isCompleted) {
      try {
        localStorage.removeItem(lsKey);
      } catch {
        /* ignore */
      }
      // Sync displayed scores from DB after finalize
      setScoreA(match.score_a);
      setScoreB(match.score_b);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted, match.score_a, match.score_b]);

  const teamA = teams.find((t) => t.id === match.team_a_id);
  const teamB = teams.find((t) => t.id === match.team_b_id);

  const bump = (side: "a" | "b", delta: number) => {
    if (!match.team_a_id || !match.team_b_id) {
      toast({
        title: "Chưa có đội",
        description: "Trận này chưa đủ 2 đội để chấm điểm.",
        variant: "destructive",
      });
      return;
    }
    if (isCompleted && delta > 0) {
      toast({
        title: "Trận đã kết thúc",
        description: "Mở lại trước khi nhập lại.",
      });
      return;
    }
    if (side === "a") setScoreA((v) => Math.max(0, v + delta));
    else setScoreB((v) => Math.max(0, v + delta));
    // Optional fire-and-forget legacy path (most callers don't pass this)
    if (onIncrement) {
      void onIncrement(side, delta).catch(() => {});
    }
  };

  const reset = () => {
    if (!confirm("Reset điểm trận này về 0-0?")) return;
    setScoreA(0);
    setScoreB(0);
    if (onReset) {
      start(async () => {
        const res = await onReset();
        if (res.error) {
          toast({
            title: "Lỗi",
            description: translateError(res.error),
            variant: "destructive",
          });
        }
      });
    }
  };

  // Two-tap confirm: first tap arms the button (visual), second tap finalizes.
  // Avoids native confirm() which is silently dismissed in some mobile webviews.
  const [armedFinalize, setArmedFinalize] = useState(false);
  useEffect(() => {
    if (!armedFinalize) return;
    const t = setTimeout(() => setArmedFinalize(false), 4000);
    return () => clearTimeout(t);
  }, [armedFinalize]);

  const finalize = () => {
    if (!onFinalize) return;
    if (scoreA === scoreB) {
      toast({
        title: "Đang hoà",
        description: "Cần chênh điểm trước khi kết thúc.",
        variant: "destructive",
      });
      return;
    }
    if (!armedFinalize) {
      setArmedFinalize(true);
      toast({
        title: "Bấm lần nữa để xác nhận",
        description: `Kết thúc trận với tỉ số ${scoreA} - ${scoreB}`,
      });
      return;
    }
    setArmedFinalize(false);
    start(async () => {
      const res = await onFinalize(scoreA, scoreB);
      if (res.error) {
        toast({
          title: "Lỗi kết thúc",
          description: translateError(res.error),
          variant: "destructive",
        });
      } else {
        toast({ title: "Đã kết thúc trận" });
        try {
          localStorage.removeItem(lsKey);
        } catch {
          /* ignore */
        }
      }
    });
  };

  const reopen = () => {
    if (!onReopen) return;
    start(async () => {
      const res = await onReopen();
      if (res.error) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
      } else {
        toast({ title: "Đã mở lại trận" });
      }
    });
  };

  const requestFullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  };

  // Wake-lock to keep phone awake during a match
  useEffect(() => {
    interface Sentinel {
      release(): Promise<void>;
    }
    let lock: Sentinel | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
    };
    const acquire = () => {
      nav.wakeLock
        ?.request("screen")
        .then((l) => {
          lock = l;
        })
        .catch(() => {});
    };
    if (nav.wakeLock) acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !lock) acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release().catch(() => {});
    };
  }, []);

  const winnerSide =
    match.status === "completed"
      ? match.winner_team_id === match.team_a_id
        ? "a"
        : match.winner_team_id === match.team_b_id
          ? "b"
          : null
      : null;

  const computedSubtitle = subtitle
    ? subtitle
    : `R${match.round} M${match.match_number}` +
      (match.group_label ? ` · Bảng ${match.group_label}` : "") +
      (match.bracket === "plate" ? " · Cúp phụ" : "") +
      (match.bracket === "main" ? " · Cúp chính" : "");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header
        className="flex items-center justify-between border-b px-3 py-2 sm:px-4 sm:py-3"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        {exitHref ? (
          <a
            href={exitHref}
            className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <ArrowLeft className="size-3.5" />
            Thoát
          </a>
        ) : (
          <span className="size-8" />
        )}
        <div className="flex flex-1 items-center justify-center gap-2 px-2 text-center text-xs sm:text-sm">
          <span className="truncate font-medium">{tournamentName}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{computedSubtitle}</span>
        </div>
        <div className="flex items-center gap-1">
          {headerExtra}
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
        {match.status === "live" && (
          <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 font-semibold text-red-500">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
            LIVE
          </span>
        )}
        {match.status === "completed" && (
          <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
            <Trophy className="size-3" />
            Kết thúc
          </span>
        )}
        {match.status === "pending" && (
          <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
            Chưa bắt đầu
          </span>
        )}
        {pending && (
          <span className="text-muted-foreground">Đang lưu…</span>
        )}
        {!isCompleted && (scoreA > 0 || scoreB > 0) && !pending && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
            • Chưa lưu — bấm Kết thúc
          </span>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 sm:grid-cols-2">
        <ScorePane
          side="a"
          name={teamA?.name ?? "TBD"}
          members={teamA ? membersByTeam?.[teamA.id] ?? [] : []}
          score={scoreA}
          isWinner={winnerSide === "a"}
          disabled={!match.team_a_id || !match.team_b_id}
          onPlus={() => bump("a", 1)}
          onMinus={() => bump("a", -1)}
        />
        <ScorePane
          side="b"
          name={teamB?.name ?? "TBD"}
          members={teamB ? membersByTeam?.[teamB.id] ?? [] : []}
          score={scoreB}
          isWinner={winnerSide === "b"}
          disabled={!match.team_a_id || !match.team_b_id}
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
          {onFinalize && match.status !== "completed" && (
            <Button
              size="sm"
              variant={armedFinalize ? "destructive" : "default"}
              onClick={finalize}
              disabled={pending || scoreA === scoreB}
            >
              <CheckCircle2 className="size-4" />
              {armedFinalize ? "Bấm lần nữa để xác nhận" : "Kết thúc trận"}
            </Button>
          )}
          {onReopen && match.status === "completed" && (
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

function ScorePane({
  side,
  name,
  members,
  score,
  isWinner,
  disabled,
  onPlus,
  onMinus,
}: {
  side: "a" | "b";
  name: string;
  members: string[];
  score: number;
  isWinner: boolean;
  disabled: boolean;
  onPlus: () => void;
  onMinus: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-between gap-3 border-b p-4 sm:border-b-0 ${
        side === "a" ? "sm:border-r" : ""
      } ${isWinner ? "bg-primary/5" : ""}`}
    >
      <div className="flex w-full flex-col items-center gap-1 text-center">
        <div className="flex w-full items-center justify-center gap-2">
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
        {members.length > 0 && (
          <p className="line-clamp-2 break-words text-[11px] text-muted-foreground sm:text-xs">
            {members.join(" · ")}
          </p>
        )}
      </div>
      <div
        className={`flex-1 select-none text-center font-mono font-black tabular-nums ${
          isWinner ? "text-primary" : ""
        }`}
        style={{ fontSize: "clamp(96px, 22vw, 220px)", lineHeight: 1 }}
      >
        {score}
      </div>
      <div className="flex w-full max-w-sm items-center justify-center gap-3">
        <button
          onClick={onMinus}
          disabled={disabled || score <= 0}
          className="flex size-16 items-center justify-center rounded-2xl border-2 border-border bg-background text-foreground transition-all active:scale-95 disabled:opacity-40 sm:size-20"
          aria-label="Giảm 1 điểm"
        >
          <Minus className="size-7 sm:size-8" />
        </button>
        <button
          onClick={onPlus}
          disabled={disabled}
          className="flex h-16 flex-1 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg transition-all active:scale-95 disabled:opacity-40 sm:h-20 sm:text-3xl"
          aria-label="Tăng 1 điểm"
        >
          <Plus className="mr-1 size-7 sm:size-8" />
          +1
        </button>
      </div>
    </div>
  );
}
