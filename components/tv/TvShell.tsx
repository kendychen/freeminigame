"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import type { TvConn } from "./useTvFeed";

export interface TvScreen {
  key: string;
  label: string;
  node: ReactNode;
}

const CANVAS_W = 1280;
const CANVAS_H = 720;
const ROTATE_MS = 12_000;

class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full items-center justify-center text-2xl text-zinc-400">
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
      setZoom(Math.max(0.2, Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H)));
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return zoom;
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const h = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(h);
  }, []);
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

  return (
    <div className="dark fixed inset-0 flex items-center justify-center overflow-hidden bg-zinc-950 text-white">
      <div
        className="relative flex flex-col overflow-hidden bg-zinc-950"
        style={{ width: CANVAS_W, height: CANVAS_H, zoom }}
      >
        <header className="flex items-end justify-between px-10 pt-7">
          <div className="min-w-0">
            <h1 className="truncate text-[34px] font-black leading-tight tracking-tight">{title}</h1>
            <p className="mt-0.5 text-lg text-zinc-400">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-lg text-zinc-400">
            <span className="flex items-center gap-2">
              <span
                className={`size-3 rounded-full ${
                  conn === "live" ? "bg-emerald-400 animate-pulse" : conn === "poll" ? "bg-amber-400" : "bg-zinc-600"
                }`}
              />
              {conn === "live" ? "Trực tiếp" : conn === "poll" ? "Cập nhật định kỳ" : "Đang kết nối"}
            </span>
            <span className="text-3xl font-bold text-white"><Clock /></span>
          </div>
        </header>

        {banner && (
          <div className="mx-10 mt-3 flex items-center gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2.5 text-xl font-semibold text-emerald-200">
            <span className="text-2xl">🔔</span>
            <span className="min-w-0 truncate">{banner}</span>
          </div>
        )}

        <main className="min-h-0 flex-1 px-10 pb-2 pt-4">
          <ScreenBoundary key={screen?.key ?? "empty"}>
            {screen ? (
              <div className="h-full">{screen.node}</div>
            ) : (
              <div className="flex h-full items-center justify-center text-3xl text-zinc-500">Đang chuẩn bị…</div>
            )}
          </ScreenBoundary>
        </main>

        <footer className="flex items-center justify-between px-10 pb-5 pt-2 text-base text-zinc-500">
          <div className="flex items-center gap-2">
            {screens.map((s, i) => (
              <span
                key={s.key}
                className={`rounded-full px-3 py-1 text-sm ${
                  i === idx ? "bg-white/15 font-semibold text-white" : "text-zinc-500"
                }`}
              >
                {s.label}
              </span>
            ))}
          </div>
          <span>Cập nhật {fmtTime(updatedAt)} · hoinhompick.team</span>
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
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] ${className}`}>
      {title && (
        <div className="shrink-0 border-b border-white/10 bg-white/[0.04] px-5 py-2.5 text-lg font-bold uppercase tracking-wide text-zinc-300">
          {title}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

/** One finished/ongoing match line: names left/right, score centre. */
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
  const aWon = done && scoreA > scoreB;
  const bWon = done && scoreB > scoreA;
  const lg = size === "lg";
  return (
    <div
      className={`flex items-center gap-4 border-b border-white/10 px-5 last:border-0 ${lg ? "py-4" : "py-2.5"} ${
        fresh ? "bg-emerald-500/15" : live ? "bg-red-500/10" : ""
      }`}
    >
      {meta && <span className={`w-24 shrink-0 text-zinc-500 ${lg ? "text-lg" : "text-base"}`}>{meta}</span>}
      <span className={`min-w-0 flex-1 truncate ${lg ? "text-2xl" : "text-xl"} ${aWon ? "font-bold text-white" : done ? "text-zinc-400" : "text-zinc-100"}`}>
        {a}
      </span>
      <span
        className={`shrink-0 rounded-lg px-3 py-0.5 font-mono font-black tabular-nums ${lg ? "text-3xl" : "text-2xl"} ${
          live ? "bg-red-500 text-white" : fresh ? "bg-emerald-400 text-zinc-950" : done ? "bg-white/10" : "text-zinc-500"
        }`}
      >
        {done || live || scoreA + scoreB > 0 ? `${scoreA} – ${scoreB}` : "vs"}
      </span>
      <span className={`min-w-0 flex-1 truncate text-right ${lg ? "text-2xl" : "text-xl"} ${bWon ? "font-bold text-white" : done ? "text-zinc-400" : "text-zinc-100"}`}>
        {b}
      </span>
      {fresh && <span className="shrink-0 rounded bg-emerald-400 px-2 py-0.5 text-sm font-black text-zinc-950">MỚI</span>}
      {live && !fresh && <span className="shrink-0 animate-pulse rounded bg-red-500 px-2 py-0.5 text-sm font-black">LIVE</span>}
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
    <div className="flex h-full flex-col rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-500/15 to-transparent p-5">
      <div className="flex items-center justify-between text-lg">
        <span className="font-bold uppercase tracking-wide text-red-300">
          <span className="mr-2 inline-block size-3 animate-pulse rounded-full bg-red-500" />
          {label}
        </span>
        <span className="text-zinc-400">{note ?? (target ? `Tới ${target} điểm` : "")}</span>
      </div>
      <div className="mt-3 grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-4">
        <p className={`truncate text-3xl ${lead === "a" ? "font-black text-white" : "font-semibold text-zinc-300"}`}>{a}</p>
        <p className="font-mono text-[84px] font-black leading-none tabular-nums">
          <span className={lead === "a" ? "text-white" : "text-zinc-400"}>{scoreA}</span>
          <span className="mx-3 text-zinc-600">:</span>
          <span className={lead === "b" ? "text-white" : "text-zinc-400"}>{scoreB}</span>
        </p>
        <p className={`truncate text-right text-3xl ${lead === "b" ? "font-black text-white" : "font-semibold text-zinc-300"}`}>{b}</p>
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
  return (
    <table className="w-full text-xl">
      <thead>
        <tr className="border-b border-white/10 text-base uppercase tracking-wide text-zinc-500">
          {head.map((h, i) => (
            <th key={h} className={`px-4 py-2 ${i <= 1 ? "text-left" : "text-center"}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={r.id}
            className={`border-b border-white/5 last:border-0 ${advance && i < advance ? "bg-emerald-500/10" : ""} ${
              advance && i >= advance ? "text-zinc-400" : ""
            }`}
          >
            {r.cells.map((c, j) => (
              <td
                key={j}
                className={`px-4 py-2 ${j === 0 ? "w-14 font-black" : j === 1 ? "truncate font-semibold" : "text-center font-mono tabular-nums"} ${
                  j === 0 && i === 0 ? "text-yellow-400" : ""
                }`}
              >
                {j === 0 ? `${c}.` : c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
