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
  subtitle?: string;
  exitHref?: string | null;
  headerExtra?: React.ReactNode;
  onIncrement?: (side: "a" | "b", delta: number) => Promise<{ error?: string }>;
  onReset?: () => Promise<{ error?: string }>;
  onFinalize?: (scoreA: number, scoreB: number) => Promise<{ error?: string }>;
  onReopen?: () => Promise<{ error?: string }>;
  membersByTeam?: Record<string, string[]>;
  /** Enable pickleball traditional scoring with server tracking */
  pickleballMode?: boolean;
}

type ServingTeam = "a" | "b";
type ServerNum = 1 | 2;

interface PbSnapshot {
  scoreA: number;
  scoreB: number;
  servingTeam: ServingTeam;
  serverNumber: ServerNum;
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
  pickleballMode = false,
}: RefereeBoardProps) {
  const [pending, start] = useTransition();
  const lsKey = `ref-score:${match.id}`;
  const isCompleted = match.status === "completed";

  const [scoreA, setScoreA] = useState<number>(match.score_a);
  const [scoreB, setScoreB] = useState<number>(match.score_b);

  // Pickleball state
  const [servingTeam, setServingTeam] = useState<ServingTeam | null>(null);
  const [serverNumber, setServerNumber] = useState<ServerNum>(2);
  const [pbHistory, setPbHistory] = useState<PbSnapshot[]>([]);

  // Restore from localStorage
  useEffect(() => {
    if (isCompleted) return;
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return;
      const v = JSON.parse(raw) as {
        a?: number; b?: number;
        serving?: ServingTeam | null;
        serverNum?: ServerNum;
        history?: PbSnapshot[];
      };
      if (typeof v.a === "number") setScoreA(v.a);
      if (typeof v.b === "number") setScoreB(v.b);
      if (pickleballMode) {
        if (v.serving !== undefined) setServingTeam(v.serving ?? null);
        if (v.serverNum) setServerNumber(v.serverNum);
        if (Array.isArray(v.history)) setPbHistory(v.history);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  // Persist to localStorage
  useEffect(() => {
    if (isCompleted) return;
    try {
      localStorage.setItem(lsKey, JSON.stringify({
        a: scoreA, b: scoreB,
        serving: servingTeam,
        serverNum: serverNumber,
        history: pbHistory,
      }));
    } catch { /* ignore */ }
  }, [scoreA, scoreB, servingTeam, serverNumber, pbHistory, isCompleted, lsKey]);

  // Sync from DB on complete
  useEffect(() => {
    if (isCompleted) {
      try { localStorage.removeItem(lsKey); } catch { /* ignore */ }
      setScoreA(match.score_a);
      setScoreB(match.score_b);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted, match.score_a, match.score_b]);

  const teamA = teams.find((t) => t.id === match.team_a_id);
  const teamB = teams.find((t) => t.id === match.team_b_id);
  const hasTeams = !!match.team_a_id && !!match.team_b_id;

  // ─── Standard mode actions ───────────────────────────────────────────────
  const bump = (side: "a" | "b", delta: number) => {
    if (!hasTeams) {
      toast({ title: "Chưa có đội", description: "Trận này chưa đủ 2 đội.", variant: "destructive" });
      return;
    }
    if (isCompleted && delta > 0) {
      toast({ title: "Trận đã kết thúc", description: "Mở lại trước khi nhập lại." });
      return;
    }
    if (side === "a") setScoreA((v) => Math.max(0, v + delta));
    else setScoreB((v) => Math.max(0, v + delta));
    if (onIncrement) void onIncrement(side, delta).catch(() => {});
  };

  // ─── Pickleball mode actions ──────────────────────────────────────────────
  const startServing = (team: ServingTeam) => {
    setServingTeam(team);
    setServerNumber(2); // first serving team always starts at server 2
    setPbHistory([]);
  };

  const pbSnap = (): PbSnapshot => ({
    scoreA, scoreB, servingTeam: servingTeam!, serverNumber,
  });

  const scorePoint = () => {
    if (!servingTeam || isCompleted || !hasTeams) return;
    setPbHistory((h) => [...h, pbSnap()]);
    if (servingTeam === "a") setScoreA((v) => v + 1);
    else setScoreB((v) => v + 1);
    if (onIncrement) void onIncrement(servingTeam, 1).catch(() => {});
  };

  const sideOut = () => {
    if (!servingTeam || isCompleted || !hasTeams) return;
    setPbHistory((h) => [...h, pbSnap()]);
    if (serverNumber === 1) {
      setServerNumber(2);
    } else {
      setServingTeam((t) => (t === "a" ? "b" : "a"));
      setServerNumber(1);
    }
  };

  const undoPb = () => {
    const prev = pbHistory[pbHistory.length - 1];
    if (!prev) return;
    setPbHistory((h) => h.slice(0, -1));
    setScoreA(prev.scoreA);
    setScoreB(prev.scoreB);
    setServingTeam(prev.servingTeam);
    setServerNumber(prev.serverNumber);
  };

  // ─── Shared actions ───────────────────────────────────────────────────────
  const reset = () => {
    if (!confirm("Reset điểm trận này về 0-0?")) return;
    setScoreA(0);
    setScoreB(0);
    if (pickleballMode) {
      setServingTeam(null);
      setServerNumber(2);
      setPbHistory([]);
    }
    if (onReset) {
      start(async () => {
        const res = await onReset();
        if (res.error) toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
      });
    }
  };

  const [armedFinalize, setArmedFinalize] = useState(false);
  useEffect(() => {
    if (!armedFinalize) return;
    const t = setTimeout(() => setArmedFinalize(false), 4000);
    return () => clearTimeout(t);
  }, [armedFinalize]);

  const finalize = () => {
    if (!onFinalize) return;
    if (scoreA === scoreB) {
      toast({ title: "Đang hoà", description: "Cần chênh điểm trước khi kết thúc.", variant: "destructive" });
      return;
    }
    if (!armedFinalize) {
      setArmedFinalize(true);
      toast({ title: "Bấm lần nữa để xác nhận", description: `Kết thúc trận với tỉ số ${scoreA} - ${scoreB}` });
      return;
    }
    setArmedFinalize(false);
    start(async () => {
      const res = await onFinalize(scoreA, scoreB);
      if (res.error) {
        toast({ title: "Lỗi kết thúc", description: translateError(res.error), variant: "destructive" });
      } else {
        toast({ title: "Đã kết thúc trận" });
        try { localStorage.removeItem(lsKey); } catch { /* ignore */ }
      }
    });
  };

  const reopen = () => {
    if (!onReopen) return;
    start(async () => {
      const res = await onReopen();
      if (res.error) {
        toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
      } else {
        toast({ title: "Đã mở lại trận" });
      }
    });
  };

  const requestFullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };

  // Wake-lock
  useEffect(() => {
    interface Sentinel { release(): Promise<void>; }
    let lock: Sentinel | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
    };
    const acquire = () => {
      nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
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
      ? match.winner_team_id === match.team_a_id ? "a"
      : match.winner_team_id === match.team_b_id ? "b"
      : null
      : null;

  const computedSubtitle = subtitle
    ? subtitle
    : `R${match.round} M${match.match_number}` +
      (match.group_label ? ` · Bảng ${match.group_label}` : "") +
      (match.bracket === "plate" ? " · Cúp phụ" : "") +
      (match.bracket === "main" ? " · Cúp chính" : "");

  const showServingChoice = pickleballMode && !isCompleted && servingTeam === null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Serving choice overlay */}
      {showServingChoice && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-background/95 px-6 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-lg font-bold">Đội nào giao bóng trước?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Đội được chọn sẽ bắt đầu ở Tay 2
            </p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-3">
            <button
              onClick={() => startServing("a")}
              className="flex h-16 items-center justify-center gap-3 rounded-2xl border-2 border-blue-400 bg-blue-500/10 text-xl font-bold text-blue-600 transition-all active:scale-95 dark:border-blue-500 dark:text-blue-400"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-blue-500/20 text-sm">A</span>
              {teamA?.name ?? "Đội A"}
            </button>
            <button
              onClick={() => startServing("b")}
              className="flex h-16 items-center justify-center gap-3 rounded-2xl border-2 border-orange-400 bg-orange-500/10 text-xl font-bold text-orange-600 transition-all active:scale-95 dark:border-orange-500 dark:text-orange-400"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-orange-500/20 text-sm">B</span>
              {teamB?.name ?? "Đội B"}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
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

      {/* Status bar */}
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
        {pending && <span className="text-muted-foreground">Đang lưu…</span>}
        {!isCompleted && (scoreA > 0 || scoreB > 0) && !pending && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
            • Chưa lưu — bấm Kết thúc
          </span>
        )}
      </div>

      {/* Pickleball serving indicator */}
      {pickleballMode && servingTeam && !isCompleted && (
        <div className="flex items-center justify-center gap-2 border-b bg-primary/5 py-1.5 text-sm font-semibold text-primary">
          <span className="text-base">🏓</span>
          <span>
            {servingTeam === "a" ? (teamA?.name ?? "Đội A") : (teamB?.name ?? "Đội B")}
            {" "}đang giao · <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs">Tay {serverNumber}</span>
          </span>
          <span className="ml-1 font-mono text-xs text-muted-foreground">
            {servingTeam === "a" ? scoreA : scoreB}
            {" – "}
            {servingTeam === "a" ? scoreB : scoreA}
            {" – "}
            {serverNumber}
          </span>
        </div>
      )}

      {/* Score panes */}
      <div className="grid flex-1 grid-cols-1 sm:grid-cols-2">
        <ScorePane
          side="a"
          name={teamA?.name ?? "TBD"}
          members={teamA ? membersByTeam?.[teamA.id] ?? [] : []}
          score={scoreA}
          isWinner={winnerSide === "a"}
          isServing={pickleballMode && servingTeam === "a"}
          disabled={!hasTeams}
          onPlus={pickleballMode ? undefined : () => bump("a", 1)}
          onMinus={pickleballMode ? undefined : () => bump("a", -1)}
        />
        <ScorePane
          side="b"
          name={teamB?.name ?? "TBD"}
          members={teamB ? membersByTeam?.[teamB.id] ?? [] : []}
          score={scoreB}
          isWinner={winnerSide === "b"}
          isServing={pickleballMode && servingTeam === "b"}
          disabled={!hasTeams}
          onPlus={pickleballMode ? undefined : () => bump("b", 1)}
          onMinus={pickleballMode ? undefined : () => bump("b", -1)}
        />
      </div>

      {/* Footer */}
      <footer
        className="border-t bg-card/50 px-3 py-2.5 sm:px-4 sm:py-3"
        style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2">
          {pickleballMode && !isCompleted && servingTeam ? (
            <>
              {/* Pickleball action buttons */}
              <button
                onClick={scorePoint}
                disabled={!hasTeams || pending}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-md transition-all active:scale-95 disabled:opacity-40 sm:h-16 sm:text-lg"
                aria-label="Điểm cho đội đang giao"
              >
                <Plus className="size-5" />
                Điểm
              </button>
              <button
                onClick={sideOut}
                disabled={!hasTeams || pending}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-orange-400 bg-orange-500/10 text-base font-bold text-orange-600 transition-all active:scale-95 disabled:opacity-40 dark:border-orange-500 dark:text-orange-400 sm:h-16 sm:text-lg"
                aria-label="Mất giao bóng"
              >
                Mất giao
              </button>
              <button
                onClick={undoPb}
                disabled={pbHistory.length === 0 || pending}
                className="flex h-14 items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-4 text-sm font-medium transition-all active:scale-95 disabled:opacity-40 sm:h-16"
                aria-label="Hoàn tác"
              >
                <Undo2 className="size-4" />
                Undo
              </button>
              <button
                onClick={reset}
                disabled={pending}
                className="flex h-14 items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-3 text-sm text-muted-foreground transition-all active:scale-95 disabled:opacity-40 sm:h-16"
              >
                <RotateCcw className="size-4" />
              </button>
              {onFinalize && (
                <button
                  onClick={finalize}
                  disabled={pending || scoreA === scoreB}
                  className={`flex h-14 items-center justify-center gap-1.5 rounded-2xl px-4 text-sm font-medium transition-all active:scale-95 disabled:opacity-40 sm:h-16 ${
                    armedFinalize
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  <CheckCircle2 className="size-4" />
                  {armedFinalize ? "Xác nhận?" : "Kết thúc"}
                </button>
              )}
            </>
          ) : !pickleballMode ? (
            <>
              {/* Standard mode buttons */}
              <Button variant="outline" size="sm" onClick={reset} disabled={pending}>
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
            </>
          ) : null}

          {/* Reopen — always shown when applicable */}
          {onReopen && match.status === "completed" && (
            <Button variant="outline" size="sm" onClick={reopen} disabled={pending}>
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
  isServing = false,
  disabled,
  onPlus,
  onMinus,
}: {
  side: "a" | "b";
  name: string;
  members: string[];
  score: number;
  isWinner: boolean;
  isServing?: boolean;
  disabled: boolean;
  onPlus?: () => void;
  onMinus?: () => void;
}) {
  const accentA = "bg-blue-500/15 text-blue-500";
  const accentB = "bg-orange-500/15 text-orange-500";
  const accent = side === "a" ? accentA : accentB;

  return (
    <div
      className={`flex flex-col items-center justify-between gap-3 border-b p-4 transition-colors sm:border-b-0 ${
        side === "a" ? "sm:border-r" : ""
      } ${isWinner ? "bg-primary/5" : ""} ${isServing ? "bg-primary/8 ring-2 ring-inset ring-primary/30" : ""}`}
    >
      <div className="flex w-full flex-col items-center gap-1 text-center">
        <div className="flex w-full items-center justify-center gap-2">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${accent}`}>
            {side.toUpperCase()}
          </span>
          <span className="line-clamp-2 break-words text-base font-bold sm:text-xl">{name}</span>
          {isWinner && <Trophy className="size-5 shrink-0 text-primary" />}
          {isServing && !isWinner && (
            <span className="text-base leading-none" title="Đang giao bóng">🏓</span>
          )}
        </div>
        {members.length > 0 && (
          <p className="line-clamp-2 break-words text-[11px] text-muted-foreground sm:text-xs">
            {members.join(" · ")}
          </p>
        )}
      </div>

      <div
        className={`flex-1 select-none text-center font-mono font-black tabular-nums ${isWinner ? "text-primary" : ""}`}
        style={{ fontSize: "clamp(96px, 22vw, 220px)", lineHeight: 1 }}
      >
        {score}
      </div>

      {/* Standard mode +/- buttons — hidden in pickleball mode */}
      {onPlus && onMinus && (
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
      )}

      {/* Pickleball mode — spacer to keep layout balanced */}
      {!onPlus && !onMinus && <div className="h-10" />}
    </div>
  );
}
