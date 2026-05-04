"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Link2,
  Maximize2,
  Plus,
  RotateCcw,
  Trophy,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export interface QuickScore {
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

type ServingTeam = "a" | "b";
type ServerNum = 1 | 2;

interface PbSnapshot {
  scoreA: number;
  scoreB: number;
  servingTeam: ServingTeam;
  serverNumber: ServerNum;
}

export function QuickScoreClient({ initial, onBack }: { initial: QuickScore; onBack?: () => void }) {
  const [score, setScore] = useState<QuickScore>(initial);
  const [pending, start] = useTransition();
  const [armedFinalize, setArmedFinalize] = useState(false);
  const channelKey = `quick-score:${initial.code}:${Math.random().toString(36).slice(2, 6)}`;

  // Pickleball state — localStorage only, not synced to DB
  const lsKey = `qs-pb:${initial.code}`;
  const [servingTeam, setServingTeam] = useState<ServingTeam | null>(null);
  const [serverNumber, setServerNumber] = useState<ServerNum>(2);
  const [pbHistory, setPbHistory] = useState<PbSnapshot[]>([]);

  // Restore pickleball state from localStorage
  useEffect(() => {
    if (score.status === "completed") return;
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return;
      const v = JSON.parse(raw) as {
        serving?: ServingTeam | null;
        serverNum?: ServerNum;
        history?: PbSnapshot[];
      };
      if (v.serving !== undefined) setServingTeam(v.serving ?? null);
      if (v.serverNum) setServerNumber(v.serverNum);
      if (Array.isArray(v.history)) setPbHistory(v.history);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.code]);

  // Persist pickleball state
  useEffect(() => {
    if (score.status === "completed") return;
    try {
      localStorage.setItem(lsKey, JSON.stringify({
        serving: servingTeam,
        serverNum: serverNumber,
        history: pbHistory,
      }));
    } catch { /* ignore */ }
  }, [servingTeam, serverNumber, pbHistory, score.status, lsKey]);

  // Realtime sync from Supabase
  useEffect(() => {
    const sb = getSupabaseBrowser();
    const ch = sb
      .channel(channelKey)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quick_scores", filter: `code=eq.${initial.code}` },
        (payload: { new: QuickScore }) => { setScore(payload.new); },
      )
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [initial.code, channelKey]);

  // Wake-lock
  useEffect(() => {
    interface Sentinel { release(): Promise<void> }
    let lock: Sentinel | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
    };
    const acquire = () => {
      nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
    };
    if (nav.wakeLock) acquire();
    const onVis = () => { if (document.visibilityState === "visible" && !lock) acquire(); };
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
    const { error } = await sb.from("quick_scores").update(patch).eq("code", initial.code);
    if (error) toast({ title: "Lỗi lưu", description: error.message, variant: "destructive" });
  };

  // ─── Pickleball actions ────────────────────────────────────────────────────
  const startServing = (team: ServingTeam) => {
    setServingTeam(team);
    setServerNumber(2);
    setPbHistory([]);
  };

  const pbSnap = (): PbSnapshot => ({
    scoreA: score.score_a, scoreB: score.score_b,
    servingTeam: servingTeam!, serverNumber,
  });

  const scorePoint = () => {
    if (!servingTeam || score.status === "completed") return;
    setPbHistory((h) => [...h, pbSnap()]);
    const nextA = score.score_a + (servingTeam === "a" ? 1 : 0);
    const nextB = score.score_b + (servingTeam === "b" ? 1 : 0);
    setScore((s) => ({ ...s, score_a: nextA, score_b: nextB, status: "live" }));
    start(() => { void apply({ score_a: nextA, score_b: nextB, status: "live" }); });
  };

  const sideOut = () => {
    if (!servingTeam || score.status === "completed") return;
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
    setServingTeam(prev.servingTeam);
    setServerNumber(prev.serverNumber);
    const nextA = prev.scoreA;
    const nextB = prev.scoreB;
    setScore((s) => ({ ...s, score_a: nextA, score_b: nextB, status: nextA + nextB > 0 ? "live" : "pending" }));
    start(() => { void apply({ score_a: nextA, score_b: nextB, status: nextA + nextB > 0 ? "live" : "pending" }); });
  };

  // ─── Shared actions ────────────────────────────────────────────────────────
  const reset = () => {
    if (!confirm("Reset 0-0?")) return;
    setScore((s) => ({ ...s, score_a: 0, score_b: 0, status: "pending", winner: null }));
    setServingTeam(null);
    setServerNumber(2);
    setPbHistory([]);
    try { localStorage.removeItem(lsKey); } catch { /* ignore */ }
    start(() => { void apply({ score_a: 0, score_b: 0, status: "pending", winner: null }); });
  };

  const finalize = () => {
    if (score.score_a === score.score_b) {
      toast({ title: "Đang hoà", description: "Cần chênh điểm.", variant: "destructive" });
      return;
    }
    if (!armedFinalize) {
      setArmedFinalize(true);
      toast({ title: "Bấm lần nữa để xác nhận", description: `Kết thúc với tỉ số ${score.score_a} - ${score.score_b}` });
      return;
    }
    setArmedFinalize(false);
    const winner: "a" | "b" = score.score_a > score.score_b ? "a" : "b";
    setScore((s) => ({ ...s, status: "completed", winner }));
    try { localStorage.removeItem(lsKey); } catch { /* ignore */ }
    start(() => { void apply({ status: "completed", winner }); toast({ title: "Đã kết thúc trận" }); });
  };

  const reopen = () => {
    const status = score.score_a + score.score_b > 0 ? "live" : "pending";
    setScore((s) => ({ ...s, status, winner: null }));
    start(() => { void apply({ status, winner: null }); toast({ title: "Đã mở lại" }); });
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

  const isCompleted = score.status === "completed";
  const winnerSide = isCompleted ? score.winner : null;
  const showServingChoice = !isCompleted && servingTeam === null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">

      {/* Serving choice overlay */}
      {showServingChoice && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-background/95 px-6 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-lg font-bold">Đội nào giao bóng trước?</p>
            <p className="mt-1 text-sm text-muted-foreground">Đội được chọn sẽ bắt đầu ở Tay 2</p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-3">
            <button
              onClick={() => startServing("a")}
              className="flex h-16 items-center justify-center gap-3 rounded-2xl border-2 border-blue-400 bg-blue-500/10 text-xl font-bold text-blue-600 transition-all active:scale-95 dark:border-blue-500 dark:text-blue-400"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-blue-500/20 text-sm">A</span>
              {score.team_a_name}
            </button>
            <button
              onClick={() => startServing("b")}
              className="flex h-16 items-center justify-center gap-3 rounded-2xl border-2 border-orange-400 bg-orange-500/10 text-xl font-bold text-orange-600 transition-all active:scale-95 dark:border-orange-500 dark:text-orange-400"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-orange-500/20 text-sm">B</span>
              {score.team_b_name}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        className="flex items-center justify-between border-b px-3 py-2 sm:px-4 sm:py-3"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <a
          href="/"
          onClick={onBack ? (e) => { e.preventDefault(); onBack(); } : undefined}
          className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <ArrowLeft className="size-3.5" />
          Thoát
        </a>
        <div className="flex flex-1 items-center justify-center gap-2 px-2 text-center text-xs sm:text-sm">
          <span className="truncate font-medium">{score.title ?? "Tỷ số nhanh"}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">Mã <code className="font-mono">{initial.code}</code></span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyLink}
            className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
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

      {/* Status bar */}
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
        {pending && <span className="text-muted-foreground">Đang lưu…</span>}
      </div>

      {/* Pickleball serving indicator */}
      {servingTeam && !isCompleted && (
        <div className="flex items-center justify-center gap-2 border-b bg-primary/5 py-1.5 text-sm font-semibold text-primary">
          <span className="text-base">🏓</span>
          <span>
            {servingTeam === "a" ? score.team_a_name : score.team_b_name}
            {" "}đang giao ·{" "}
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs">Tay {serverNumber}</span>
          </span>
          <span className="ml-1 font-mono text-xs text-muted-foreground">
            {servingTeam === "a" ? score.score_a : score.score_b}
            {" – "}
            {servingTeam === "a" ? score.score_b : score.score_a}
            {" – "}
            {serverNumber}
          </span>
        </div>
      )}

      {/* Score panes */}
      <div className="grid flex-1 grid-cols-1 sm:grid-cols-2">
        <Pane
          side="a"
          name={score.team_a_name}
          value={score.score_a}
          isWinner={winnerSide === "a"}
          isServing={servingTeam === "a"}
        />
        <Pane
          side="b"
          name={score.team_b_name}
          value={score.score_b}
          isWinner={winnerSide === "b"}
          isServing={servingTeam === "b"}
        />
      </div>

      {/* Footer */}
      <footer
        className="border-t bg-card/50 px-3 py-2.5 sm:px-4 sm:py-3"
        style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2">
          {!isCompleted && servingTeam ? (
            <>
              <button
                onClick={scorePoint}
                disabled={pending}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-md transition-all active:scale-95 disabled:opacity-40 sm:h-16 sm:text-lg"
              >
                <Plus className="size-5" />
                Điểm
              </button>
              <button
                onClick={sideOut}
                disabled={pending}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-orange-400 bg-orange-500/10 text-base font-bold text-orange-600 transition-all active:scale-95 disabled:opacity-40 dark:border-orange-500 dark:text-orange-400 sm:h-16 sm:text-lg"
              >
                Mất giao
              </button>
              <button
                onClick={undoPb}
                disabled={pbHistory.length === 0 || pending}
                className="flex h-14 items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-4 text-sm font-medium transition-all active:scale-95 disabled:opacity-40 sm:h-16"
              >
                <Undo2 className="size-4" />
                Undo
              </button>
              <button
                onClick={reset}
                disabled={pending}
                className="flex h-14 items-center justify-center rounded-2xl border border-border bg-background px-3 text-muted-foreground transition-all active:scale-95 disabled:opacity-40 sm:h-16"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                onClick={finalize}
                disabled={pending || score.score_a === score.score_b}
                className={`flex h-14 items-center justify-center gap-1.5 rounded-2xl px-4 text-sm font-medium transition-all active:scale-95 disabled:opacity-40 sm:h-16 ${
                  armedFinalize ? "bg-destructive text-destructive-foreground" : "bg-secondary text-foreground"
                }`}
              >
                <CheckCircle2 className="size-4" />
                {armedFinalize ? "Xác nhận?" : "Kết thúc"}
              </button>
            </>
          ) : isCompleted ? (
            <Button variant="outline" size="sm" onClick={reopen} disabled={pending}>
              <Undo2 className="size-4" />
              Mở lại
            </Button>
          ) : null}
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
  isServing = false,
}: {
  side: "a" | "b";
  name: string;
  value: number;
  isWinner: boolean;
  isServing?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-between gap-3 border-b p-4 transition-colors sm:border-b-0 ${
        side === "a" ? "sm:border-r" : ""
      } ${isWinner ? "bg-primary/5" : ""} ${isServing ? "ring-2 ring-inset ring-primary/30" : ""}`}
    >
      <div className="flex w-full items-center justify-center gap-2 text-center">
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            side === "a" ? "bg-blue-500/15 text-blue-500" : "bg-orange-500/15 text-orange-500"
          }`}
        >
          {side.toUpperCase()}
        </span>
        <span className="line-clamp-2 break-words text-base font-bold sm:text-xl">{name}</span>
        {isWinner && <Trophy className="size-5 shrink-0 text-primary" />}
        {isServing && !isWinner && <span className="text-base leading-none">🏓</span>}
      </div>
      <div
        className={`flex-1 select-none text-center font-mono font-black tabular-nums ${isWinner ? "text-primary" : ""}`}
        style={{ fontSize: "clamp(96px, 22vw, 220px)", lineHeight: 1 }}
      >
        {value}
      </div>
      <div className="h-10" />
    </div>
  );
}
