"use client";

import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { TvConn } from "./useTvFeed";

export interface TvScreen {
  key: string;
  label: string;
  node: ReactNode;
}

const CANVAS_W = 1280;
const CANVAS_H = 720;
const ROTATE_MS = 8_000;

// "Sunset Court" palette on a deep navy ground: orange for identity/accents,
// emerald for advancing/winning, rose for live play.
const BG_GLOW =
  "radial-gradient(900px 520px at 0% 0%, rgba(249,115,22,0.16), transparent 60%)," +
  "radial-gradient(900px 520px at 100% 100%, rgba(14,165,233,0.13), transparent 60%)";

class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full items-center justify-center text-2xl text-slate-400">
          Không hiển thị được màn này — sẽ thử lại ở vòng sau.
        </div>
      );
    }
    return this.props.children;
  }
}

function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void>; released?: boolean };
    let lock: Sentinel | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
    };
    const acquire = () => {
      nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
    };
    if (nav.wakeLock) acquire();
    const onVis = () => {
      if (document.visibilityState === "visible" && (!lock || lock.released)) acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);
}

function useZoom() {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const calc = () =>
      setZoom(Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H));
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return zoom;
}

// Local time differs between the server (UTC) and the TV, so time strings
// render only after hydration to avoid a mismatch.
const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

function Clock() {
  const mounted = useMounted();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const h = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(h);
  }, []);
  if (!mounted) return <span className="tabular-nums">--:--</span>;
  return <span className="tabular-nums">{now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>;
}

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * Fullscreen TV chrome: a fixed 1280×720 canvas scaled with CSS zoom to fit
 * any screen, dark palette, auto-rotating screens (timer never resets on data
 * changes, so a busy referee can't pin one screen), wake lock, and a
 * fullscreen button that hides itself.
 */
export function TvShell({
  title,
  subtitle,
  screens,
  conn,
  updatedAt,
  banner,
}: {
  title: string;
  subtitle: string;
  screens: TvScreen[];
  conn: TvConn;
  updatedAt: number;
  banner?: ReactNode;
}) {
  useWakeLock();
  const zoom = useZoom();
  const [tickIdx, setTickIdx] = useState(0);
  const mounted = useMounted();
  const [showCtl, setShowCtl] = useState(true);
  const [isFs, setIsFs] = useState(false);

  const count = Math.max(screens.length, 1);
  const idx = tickIdx % count;

  useEffect(() => {
    if (count <= 1) return;
    const h = setTimeout(() => setTickIdx((i) => i + 1), ROTATE_MS);
    return () => clearTimeout(h);
  }, [tickIdx, count]);

  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | undefined;
    const poke = () => {
      setShowCtl(true);
      if (hide) clearTimeout(hide);
      hide = setTimeout(() => setShowCtl(false), 4000);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setTickIdx((i) => i + 1);
      if (e.key === "ArrowLeft") setTickIdx((i) => (i - 1 + count * 1000) % (count * 1000));
      poke();
    };
    const onFs = () => setIsFs(!!document.fullscreenElement);
    poke();
    window.addEventListener("pointermove", poke);
    window.addEventListener("pointerdown", poke);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      if (hide) clearTimeout(hide);
      window.removeEventListener("pointermove", poke);
      window.removeEventListener("pointerdown", poke);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [count]);

  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const screen = screens[idx];
  const connLabel = conn === "live" ? "Trực tiếp" : conn === "poll" ? "Cập nhật định kỳ" : "Đang kết nối";
  const connDot = conn === "live" ? "bg-emerald-400 animate-pulse" : conn === "poll" ? "bg-amber-400" : "bg-slate-600";

  return (
    <div className="dark fixed inset-0 flex items-center justify-center overflow-hidden bg-[#070b14] text-slate-100">
      <style>{`@keyframes tvfill{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
      <div
        className="relative flex flex-col overflow-hidden bg-[#070b14]"
        style={{ width: CANVAS_W, height: CANVAS_H, zoom, backgroundImage: BG_GLOW }}
      >
        <header className="flex items-center justify-between gap-6 px-10 pt-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="h-14 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-orange-400 to-rose-500" />
            <div className="min-w-0">
              <h1 className="break-words text-[32px] font-extrabold leading-tight tracking-tight text-white">{title}</h1>
              <p className="mt-0.5 text-lg text-slate-400">{subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-5">
            <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-base text-slate-300">
              <span className={`size-2.5 rounded-full ${connDot}`} />
              {connLabel}
            </span>
            <span className="font-mono text-[34px] font-bold text-white"><Clock /></span>
          </div>
        </header>

        {banner && (
          <div className="mx-10 mt-3 flex items-center gap-3 rounded-2xl border border-orange-400/40 bg-gradient-to-r from-orange-500/25 to-orange-500/5 px-5 py-2.5 text-xl font-semibold text-orange-50">
            <span className="text-2xl">🔔</span>
            <span className="min-w-0 break-words leading-snug">{banner}</span>
          </div>
        )}

        <main className="min-h-0 flex-1 px-10 pb-2 pt-4">
          <ScreenBoundary key={screen?.key ?? "empty"}>
            {screen ? (
              <div className="h-full">{screen.node}</div>
            ) : (
              <div className="flex h-full items-center justify-center text-3xl text-slate-500">Đang chuẩn bị…</div>
            )}
          </ScreenBoundary>
        </main>

        <footer className="flex items-center justify-between px-10 pb-5 pt-2 text-base text-slate-500">
          <div className="flex items-center gap-2">
            {screens.map((s, i) => (
              <span
                key={s.key}
                className={`relative overflow-hidden rounded-full px-3.5 py-1 text-sm ${
                  i === idx ? "bg-white/10 font-semibold text-white" : "text-slate-500"
                }`}
              >
                {s.label}
                {i === idx && count > 1 && (
                  <span
                    key={tickIdx}
                    className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-orange-400"
                    style={{ animation: `tvfill ${ROTATE_MS}ms linear forwards` }}
                  />
                )}
              </span>
            ))}
          </div>
          <span>
            Cập nhật {mounted ? fmtTime(updatedAt) : "--:--:--"} · <span className="text-orange-300/80">hoinhompick.team</span>
          </span>
        </footer>

        <button
          type="button"
          onClick={toggleFs}
          className={`absolute bottom-16 right-10 rounded-xl border border-white/20 bg-black/60 px-4 py-2 text-base font-semibold backdrop-blur transition-opacity ${
            showCtl ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {isFs ? "Thoát toàn màn hình" : "⛶ Toàn màn hình"}
        </button>
      </div>
    </div>
  );
}

/* ── Shared TV primitives ─────────────────────────────────────────────────── */

export function TvCard({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0e1526]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${className}`}
    >
      {title && (
        <div className="shrink-0 border-b border-white/[0.08] bg-gradient-to-r from-orange-500/15 to-transparent px-5 py-2.5 text-[15px] font-bold uppercase tracking-[0.12em] text-orange-200">
          {title}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

function ScoreLine({
  name,
  score,
  won,
  done,
  live,
  lg,
  showScore,
}: {
  name: string;
  score: number;
  won: boolean;
  done?: boolean;
  live?: boolean;
  lg: boolean;
  showScore: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span
        className={`min-w-0 break-words leading-snug ${lg ? "text-2xl" : "text-xl"} ${
          won ? "font-bold text-white" : done ? "text-slate-400" : "text-slate-200"
        }`}
      >
        {won && <span className="mr-2 text-orange-400">▸</span>}
        {name}
      </span>
      <span
        className={`shrink-0 font-mono font-black tabular-nums ${lg ? "text-3xl" : "text-2xl"} ${
          live ? "text-rose-300" : won ? "text-white" : done ? "text-slate-500" : "text-slate-600"
        }`}
      >
        {showScore ? score : "–"}
      </span>
    </div>
  );
}

/** One finished/ongoing match: two full-width lines (name … score), nothing truncated. */
export function TvMatchRow({
  a,
  b,
  scoreA,
  scoreB,
  meta,
  live,
  done,
  fresh,
  size = "md",
}: {
  a: string;
  b: string;
  scoreA: number;
  scoreB: number;
  meta?: string;
  live?: boolean;
  done?: boolean;
  fresh?: boolean;
  size?: "md" | "lg";
}) {
  const aWon = !!done && scoreA > scoreB;
  const bWon = !!done && scoreB > scoreA;
  const lg = size === "lg";
  const showScore = !!done || !!live || scoreA + scoreB > 0;
  return (
    <div
      className={`flex items-center gap-4 border-b border-white/[0.06] px-5 last:border-0 ${lg ? "py-3.5" : "py-2.5"} ${
        fresh ? "bg-emerald-500/12" : live ? "bg-rose-500/10" : ""
      }`}
    >
      {meta && <span className="w-20 shrink-0 text-base text-slate-500">{meta}</span>}
      <div className="min-w-0 flex-1 space-y-1">
        <ScoreLine name={a} score={scoreA} won={aWon} done={done} live={live} lg={lg} showScore={showScore} />
        <ScoreLine name={b} score={scoreB} won={bWon} done={done} live={live} lg={lg} showScore={showScore} />
      </div>
      {fresh && <span className="shrink-0 rounded-md bg-emerald-400 px-2 py-0.5 text-sm font-black text-emerald-950">MỚI</span>}
      {live && !fresh && <span className="shrink-0 animate-pulse rounded-md bg-rose-500 px-2 py-0.5 text-sm font-black text-white">LIVE</span>}
    </div>
  );
}

/** Big scoreboard for a match in progress. */
export function TvLiveCard({
  label,
  a,
  b,
  scoreA,
  scoreB,
  target,
  note,
}: {
  label: string;
  a: string;
  b: string;
  scoreA: number;
  scoreB: number;
  target?: number | null;
  note?: string;
}) {
  const lead = scoreA === scoreB ? null : scoreA > scoreB ? "a" : "b";
  return (
    <div className="flex h-full flex-col rounded-3xl border border-rose-500/40 bg-gradient-to-br from-rose-500/20 via-[#0e1526]/90 to-[#0e1526]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between text-lg">
        <span className="flex items-center gap-2 font-bold uppercase tracking-[0.12em] text-rose-300">
          <span className="inline-block size-3 animate-pulse rounded-full bg-rose-500" />
          {label}
        </span>
        <span className="text-slate-400">{note ?? (target ? `Tới ${target} điểm` : "")}</span>
      </div>
      <div className="mt-3 grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-5">
        <p className={`break-words text-[28px] leading-snug ${lead === "a" ? "font-black text-white" : "font-semibold text-slate-300"}`}>{a}</p>
        <p className="font-mono text-[84px] font-black leading-none tabular-nums">
          <span className={lead === "a" ? "text-white" : "text-slate-400"}>{scoreA}</span>
          <span className="mx-3 text-slate-600">:</span>
          <span className={lead === "b" ? "text-white" : "text-slate-400"}>{scoreB}</span>
        </p>
        <p className={`break-words text-right text-[28px] leading-snug ${lead === "b" ? "font-black text-white" : "font-semibold text-slate-300"}`}>{b}</p>
      </div>
    </div>
  );
}

/** Generic standings table; `rows` already sorted. */
export function TvStandings({
  head,
  rows,
  advance = 0,
}: {
  head: string[];
  rows: { id: string; cells: (string | number)[]; strong?: boolean }[];
  advance?: number;
}) {
  // Names wrap instead of being cut; numeric columns keep a fixed share so a
  // long name can't push them out of the card. A 12-player group has to fit
  // one 720px screen, hence the dense mode.
  const dense = rows.length > 8;
  const numW = `${Math.floor(50 / Math.max(head.length - 2, 1))}%`;
  return (
    <table className={`w-full table-fixed ${dense ? "text-lg" : "text-xl"}`}>
      <colgroup>
        <col style={{ width: 56 }} />
        <col />
        {head.slice(2).map((h) => (
          <col key={h} style={{ width: numW }} />
        ))}
      </colgroup>
      <thead>
        <tr className="border-b border-white/[0.08] text-[14px] uppercase tracking-wide text-slate-500">
          {head.map((h, i) => (
            <th key={h} className={`px-3 py-2 ${i <= 1 ? "text-left" : "text-center"}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const adv = advance > 0 && i < advance;
          return (
            <tr
              key={r.id}
              className={`border-b border-white/[0.05] last:border-0 ${adv ? "bg-emerald-500/10" : ""} ${
                advance > 0 && !adv ? "text-slate-400" : ""
              }`}
            >
              {r.cells.map((c, j) => (
                <td
                  key={j}
                  className={`px-3 ${dense ? "py-1" : "py-2"} ${
                    j === 0
                      ? `font-black ${i === 0 ? "text-orange-400" : adv ? "text-emerald-300" : "text-slate-500"}`
                      : j === 1
                        ? "break-words font-semibold leading-snug"
                        : "text-center font-mono tabular-nums"
                  }`}
                >
                  {j === 0 ? `${c}.` : c}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
