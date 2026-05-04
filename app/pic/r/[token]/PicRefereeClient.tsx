"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, CheckCircle2, Plus, Minus, ArrowRight, Trophy,
} from "lucide-react";
import { type PicMatch, type PicPlayer } from "@/stores/pic-tournament";
import { scorePicMatch } from "@/app/actions/pic";
import type { PicEventFull } from "@/app/actions/pic";

function pairName(p1: PicPlayer | undefined, p2: PicPlayer | undefined) {
  return `${p1?.name ?? "?"} & ${p2?.name ?? "?"}`;
}

// ── ScoreOverlay ───────────────────────────────────────────────────────────────

function ScoreOverlay({
  match, players, target, token, eventId, onClose,
}: {
  match: PicMatch; players: PicPlayer[]; target: number;
  token: string; eventId: string; onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const byId = (id: string) => players.find((p) => p.id === id);
  const [scoreA, setScoreA] = useState(match.scoreA);
  const [scoreB, setScoreB] = useState(match.scoreB);
  const [history, setHistory] = useState<[number, number][]>([]);
  const [armed, setArmed] = useState<[number, number] | null>(null);

  const add = (side: "a" | "b") => {
    const na = side === "a" ? scoreA + 1 : scoreA;
    const nb = side === "b" ? scoreB + 1 : scoreB;
    setHistory((h) => [...h, [scoreA, scoreB]]);
    setScoreA(na); setScoreB(nb);
    if (na >= target || nb >= target) setArmed([na, nb]);
  };
  const sub = (side: "a" | "b") => {
    if (side === "a" && scoreA <= 0) return;
    if (side === "b" && scoreB <= 0) return;
    setHistory((h) => [...h, [scoreA, scoreB]]);
    if (side === "a") setScoreA((v) => v - 1); else setScoreB((v) => v - 1);
    setArmed(null);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setScoreA(prev[0]); setScoreB(prev[1]);
    setArmed(null);
  };

  const aName = pairName(byId(match.a1), byId(match.a2));
  const bName = pairName(byId(match.b1), byId(match.b2));
  const stageLabel =
    match.stage === "group" ? `Trận ${match.round}` :
    match.stage === "semifinal" ? "Bán kết" :
    match.stage === "third" ? "Tranh 3–4" : "Chung kết";

  const confirm = (a: number, b: number) => {
    startTransition(async () => {
      await scorePicMatch({ eventId, matchId: match.id, scoreA: a, scoreB: b, token });
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {armed && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-background/95 px-6 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-lg font-semibold text-muted-foreground">Kết thúc trận?</p>
            <p className="mt-3 font-mono text-6xl font-black tabular-nums">{armed[0]} – {armed[1]}</p>
            <p className="mt-2 text-base font-semibold">{armed[0] > armed[1] ? aName : bName} thắng</p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <button onClick={() => confirm(armed[0], armed[1])}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground active:scale-95">
              <CheckCircle2 className="size-5" />Xác nhận
            </button>
            <button onClick={() => setArmed(null)}
              className="flex h-12 items-center justify-center rounded-2xl border bg-background text-sm font-medium active:scale-95">
              Tiếp tục đánh
            </button>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <button onClick={onClose} className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">
          <ChevronLeft className="size-3.5" />Quay lại
        </button>
        <div className="flex flex-col items-center text-center text-xs">
          <span className="font-semibold">{stageLabel}</span>
          <span className="text-muted-foreground">Chạm {target} điểm</span>
        </div>
        <button onClick={undo} disabled={history.length === 0} className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40">
          Undo
        </button>
      </header>
      <div className="grid flex-1 grid-cols-2">
        {(["a", "b"] as const).map((side) => {
          const score = side === "a" ? scoreA : scoreB;
          const nm = side === "a" ? aName : bName;
          const accent = side === "a" ? "text-blue-500 bg-blue-500/10" : "text-orange-500 bg-orange-500/10";
          return (
            <div key={side} className={`flex flex-col items-center gap-3 p-4 ${side === "a" ? "border-r" : ""}`}>
              <p className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${accent}`}>{side.toUpperCase()}</p>
              <p className="line-clamp-2 text-center text-sm font-semibold">{nm}</p>
              <div className="flex-1 select-none font-mono font-black tabular-nums"
                style={{ fontSize: "clamp(72px,20vw,180px)", lineHeight: 1 }}>{score}</div>
              <div className="flex w-full flex-col gap-2">
                <button onClick={() => add(side)}
                  className={`flex h-16 w-full items-center justify-center rounded-2xl text-2xl font-bold shadow-md active:scale-95 ${side === "a" ? "bg-blue-500 text-white" : "bg-orange-500 text-white"}`}>
                  <Plus className="size-7" />
                </button>
                <button onClick={() => sub(side)} disabled={score <= 0}
                  className="flex h-10 w-full items-center justify-center rounded-xl border bg-background text-muted-foreground active:scale-95 disabled:opacity-30">
                  <Minus className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Match row ──────────────────────────────────────────────────────────────────

function MatchRow({ match, players, onClick }: {
  match: PicMatch; players: PicPlayer[]; onClick: () => void;
}) {
  const byId = (id: string) => players.find((p) => p.id === id);
  const isDone = match.status === "completed";
  const aName = match.a1 ? pairName(byId(match.a1), byId(match.a2)) : "TBD";
  const bName = match.b1 ? pairName(byId(match.b1), byId(match.b2)) : "TBD";
  const aWon = isDone && match.scoreA > match.scoreB;
  const bWon = isDone && match.scoreB > match.scoreA;
  const canClick = !isDone && !!match.a1 && !!match.b1;

  return (
    <button onClick={canClick ? onClick : undefined} disabled={!canClick}
      className={`flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-3 text-left transition-colors ${
        isDone ? "opacity-60" : canClick ? "hover:border-primary/50 hover:bg-accent/30 active:scale-[0.99]" : "cursor-default opacity-40"
      }`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-500">A</span>
          <span className={`truncate text-sm ${aWon ? "font-bold text-primary" : ""}`}>{aName}</span>
          {aWon && <Trophy className="size-3.5 shrink-0 text-primary" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[10px] font-bold text-orange-500">B</span>
          <span className={`truncate text-sm ${bWon ? "font-bold text-primary" : ""}`}>{bName}</span>
          {bWon && <Trophy className="size-3.5 shrink-0 text-primary" />}
        </div>
      </div>
      <div className={`shrink-0 rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${isDone ? "bg-secondary" : "border"}`}>
        {match.scoreA} – {match.scoreB}
      </div>
      {canClick && <ArrowRight className="size-4 shrink-0 text-muted-foreground" />}
    </button>
  );
}

// ── Main referee client ────────────────────────────────────────────────────────

export default function PicRefereeClient({
  state,
  token,
}: {
  state: PicEventFull;
  token: string;
}) {
  const [activeMatch, setActiveMatch] = useState<PicMatch | null>(null);
  const { id: eventId, config, players, groups, knockoutMatches, stage } = state;

  const target = (m: PicMatch) =>
    m.stage === "group" ? config.targetGroup : config.targetKnockout;

  if (activeMatch) {
    return (
      <ScoreOverlay
        match={activeMatch}
        players={players}
        target={target(activeMatch)}
        token={token}
        eventId={eventId}
        onClose={() => setActiveMatch(null)}
      />
    );
  }

  const semiMatches = knockoutMatches.filter((m) => m.stage === "semifinal");
  const finalMatch = knockoutMatches.find((m) => m.stage === "final");
  const thirdMatch = knockoutMatches.find((m) => m.stage === "third");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-center px-4">
          <div className="text-center">
            <p className="font-semibold">{config.name}</p>
            <p className="text-[11px] text-muted-foreground">Trọng tài — không cần đăng nhập</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-4 py-4">
        {/* Done */}
        {stage === "done" && (
          <div className="rounded-xl border bg-primary/5 p-6 text-center">
            <Trophy className="mx-auto mb-2 size-8 text-primary" />
            <p className="font-bold">Giải đấu đã kết thúc</p>
          </div>
        )}

        {/* Group matches */}
        {stage === "group" && groups.map((g) => (
          <div key={g.id} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bảng {g.label} — chạm {config.targetGroup}
            </h2>
            {g.matches.map((m) => (
              <MatchRow key={m.id} match={m} players={players} onClick={() => setActiveMatch(m)} />
            ))}
          </div>
        ))}

        {/* Knockout */}
        {stage === "knockout" && (
          <>
            {semiMatches.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bán kết — chạm {config.targetKnockout}
                </h2>
                {semiMatches.map((m, i) => (
                  <MatchRow key={m.id} match={m} players={players} onClick={() => setActiveMatch(m)} />
                ))}
              </div>
            )}
            {finalMatch && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  🏆 Chung kết — chạm {config.targetKnockout}
                </h2>
                <MatchRow match={finalMatch} players={players} onClick={() => setActiveMatch(finalMatch)} />
              </div>
            )}
            {thirdMatch && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tranh hạng 3–4 — chạm {config.targetKnockout}
                </h2>
                <MatchRow match={thirdMatch} players={players} onClick={() => setActiveMatch(thirdMatch)} />
              </div>
            )}
          </>
        )}

        {/* Draw stage — waiting */}
        {stage === "draw" && (
          <div className="rounded-xl border bg-muted/30 p-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Vòng bảng hoàn thành.<br />Đang chờ bốc thăm chung kết…
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
