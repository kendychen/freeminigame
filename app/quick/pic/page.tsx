"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy, RotateCcw, ChevronLeft, Shuffle, CheckCircle2,
  Plus, Minus, Users, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  usePicStore, computeStandings,
  type PicMatch, type PicPlayer,
} from "@/stores/pic-tournament";

// ─── helpers ──────────────────────────────────────────────────────────────────

function pairName(p1: PicPlayer | undefined, p2: PicPlayer | undefined) {
  return `${p1?.name ?? "?"} & ${p2?.name ?? "?"}`;
}

function shuffle(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]!; a[j] = tmp!;
  }
  return a;
}

// ─── Score overlay ─────────────────────────────────────────────────────────────

function ScoreOverlay({
  match,
  players,
  target,
  onFinish,
  onClose,
}: {
  match: PicMatch;
  players: PicPlayer[];
  target: number;
  onFinish: (a: number, b: number) => void;
  onClose: () => void;
}) {
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
    if (side === "a") setScoreA((v) => v - 1);
    else setScoreB((v) => v - 1);
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Confirm overlay */}
      {armed && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-background/95 px-6 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-lg font-semibold text-muted-foreground">Kết thúc trận?</p>
            <p className="mt-3 font-mono text-6xl font-black tabular-nums">
              {armed[0]} – {armed[1]}
            </p>
            <p className="mt-2 text-base font-semibold">
              {armed[0] > armed[1] ? aName : bName} thắng
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <button
              onClick={() => onFinish(armed[0], armed[1])}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground transition-all active:scale-95"
            >
              <CheckCircle2 className="size-5" />
              Xác nhận
            </button>
            <button
              onClick={() => setArmed(null)}
              className="flex h-12 items-center justify-center rounded-2xl border border-border bg-background text-sm font-medium transition-all active:scale-95"
            >
              Tiếp tục đánh
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <button onClick={onClose} className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">
          <ChevronLeft className="size-3.5" />
          Quay lại
        </button>
        <div className="flex flex-col items-center text-center text-xs">
          <span className="font-semibold">
            {match.stage === "group" ? `Trận ${match.round}` : "🏆 Chung kết"}
          </span>
          <span className="text-muted-foreground">Chạm {target} điểm</span>
        </div>
        <button onClick={undo} disabled={history.length === 0} className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40">
          Undo
        </button>
      </header>

      {/* Score area */}
      <div className="grid flex-1 grid-cols-2">
        {(["a", "b"] as const).map((side) => {
          const score = side === "a" ? scoreA : scoreB;
          const name = side === "a" ? aName : bName;
          const accent = side === "a" ? "text-blue-500 bg-blue-500/10" : "text-orange-500 bg-orange-500/10";
          return (
            <div key={side} className={`flex flex-col items-center gap-3 p-4 ${side === "a" ? "border-r" : ""}`}>
              <p className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${accent}`}>
                {side.toUpperCase()}
              </p>
              <p className="line-clamp-2 text-center text-sm font-semibold">{name}</p>
              <div
                className="flex-1 select-none font-mono font-black tabular-nums"
                style={{ fontSize: "clamp(72px, 20vw, 180px)", lineHeight: 1 }}
              >
                {score}
              </div>
              <div className="flex w-full flex-col gap-2">
                <button
                  onClick={() => add(side)}
                  className={`flex h-16 w-full items-center justify-center rounded-2xl text-2xl font-bold shadow-md transition-all active:scale-95 ${
                    side === "a"
                      ? "bg-blue-500 text-white"
                      : "bg-orange-500 text-white"
                  }`}
                >
                  <Plus className="size-7" />
                </button>
                <button
                  onClick={() => sub(side)}
                  disabled={score <= 0}
                  className="flex h-10 w-full items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-all active:scale-95 disabled:opacity-30"
                >
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

// ─── Match card ────────────────────────────────────────────────────────────────

function MatchCard({
  match,
  players,
  onClick,
}: {
  match: PicMatch;
  players: PicPlayer[];
  onClick?: () => void;
}) {
  const byId = (id: string) => players.find((p) => p.id === id);
  const aName = pairName(byId(match.a1), byId(match.a2));
  const bName = pairName(byId(match.b1), byId(match.b2));
  const isDone = match.status === "completed";
  const aWon = isDone && match.scoreA > match.scoreB;
  const bWon = isDone && match.scoreB > match.scoreA;

  return (
    <button
      onClick={onClick}
      disabled={isDone}
      className={`flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-3 text-left transition-colors ${
        isDone ? "opacity-70" : "hover:border-primary/50 hover:bg-accent/30 active:scale-[0.99]"
      }`}
    >
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-500`}>A</span>
          <span className={`truncate text-sm ${aWon ? "font-bold text-primary" : ""}`}>{aName}</span>
          {aWon && <Trophy className="size-3.5 shrink-0 text-primary" />}
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex size-5 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[10px] font-bold text-orange-500`}>B</span>
          <span className={`truncate text-sm ${bWon ? "font-bold text-primary" : ""}`}>{bName}</span>
          {bWon && <Trophy className="size-3.5 shrink-0 text-primary" />}
        </div>
      </div>
      <div className={`shrink-0 rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${isDone ? "bg-secondary" : "border border-border"}`}>
        {match.scoreA} – {match.scoreB}
      </div>
      {!isDone && <ArrowRight className="size-4 shrink-0 text-muted-foreground" />}
    </button>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function PicPage() {
  const router = useRouter();
  const { current, actions } = usePicStore();
  const [activeMatch, setActiveMatch] = useState<{ match: PicMatch; stage: "group" | "knockout" } | null>(null);
  const [tab, setTab] = useState<"matches" | "standings">("matches");
  const [drawnPairs, setDrawnPairs] = useState<[[string, string], [string, string]] | null>(null);

  useEffect(() => {
    if (!current) router.replace("/quick/pic/new");
  }, [current, router]);

  if (!current) return null;

  const { config, players, groupMatches, knockoutMatches, stage } = current;
  const byId = (id: string) => players.find((p) => p.id === id);
  const standings = computeStandings(players, groupMatches);
  const allGroupDone = groupMatches.every((m) => m.status === "completed");
  const pendingGroup = groupMatches.filter((m) => m.status === "pending");
  const finalMatch = knockoutMatches[0];

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "matches", label: "Trận đấu" },
    { id: "standings", label: "Bảng điểm" },
  ];

  // ── Stage: draw ──────────────────────────────────────────────────────────────
  if (stage === "draw") {
    const top4 = standings.slice(0, 4);

    const doDraw = () => {
      const ids = shuffle(top4.map((s) => s.playerId));
      setDrawnPairs([[ids[0]!, ids[1]!], [ids[2]!, ids[3]!]]);
    };

    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
            <button onClick={() => { if (confirm("Huỷ giải và xoá dữ liệu?")) actions.reset(); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
              <RotateCcw className="size-4" />
            </button>
            <span className="font-semibold">{config.name}</span>
            <span className="w-8" />
          </div>
        </header>
        <main className="mx-auto max-w-xl space-y-5 px-4 py-6">
          <div className="rounded-xl border bg-primary/5 p-4 text-center">
            <Trophy className="mx-auto mb-2 size-8 text-primary" />
            <p className="font-bold">Vòng bảng hoàn thành!</p>
            <p className="mt-1 text-sm text-muted-foreground">Top 4 vào chung kết</p>
          </div>

          {/* Top 4 */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top 4 vào chung kết</h2>
            {top4.map((s) => (
              <div key={s.playerId} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">{s.rank}</span>
                <span className="flex-1 font-medium">{s.name}</span>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">{s.wins}W {s.diff > 0 ? "+" : ""}{s.diff}</span>
              </div>
            ))}
          </div>

          {/* Draw section */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bốc thăm cặp đôi</h2>
            <Button onClick={doDraw} variant="outline" className="w-full">
              <Shuffle className="size-4" />
              Bốc thăm ngẫu nhiên
            </Button>

            {drawnPairs && (
              <div className="space-y-2 rounded-xl border bg-card p-3">
                {drawnPairs.map((pair, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${i === 0 ? "bg-blue-500/10" : "bg-orange-500/10"}`}>
                    <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-blue-500/20 text-blue-600" : "bg-orange-500/20 text-orange-600"}`}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1 text-sm font-semibold">
                      {pair.map((id) => byId(id)?.name).join(" & ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {drawnPairs && (
            <Button onClick={() => actions.drawKnockout(drawnPairs)} size="lg" className="w-full">
              <CheckCircle2 className="size-4" />
              Xác nhận & Bắt đầu chung kết
            </Button>
          )}
        </main>
      </div>
    );
  }

  // ── Stage: done ──────────────────────────────────────────────────────────────
  if (stage === "done" && finalMatch) {
    const aWon = finalMatch.scoreA > finalMatch.scoreB;
    const winners = aWon
      ? [finalMatch.a1, finalMatch.a2]
      : [finalMatch.b1, finalMatch.b2];
    const runners = aWon
      ? [finalMatch.b1, finalMatch.b2]
      : [finalMatch.a1, finalMatch.a2];

    const top4ids = standings.slice(0, 4).map((s) => s.playerId);
    const third = top4ids.filter((id) => !winners.includes(id) && !runners.includes(id));

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b px-4 py-3 text-center">
          <p className="text-sm font-semibold text-muted-foreground">{config.name}</p>
          <h1 className="mt-0.5 text-xl font-bold">🏆 Kết quả</h1>
        </header>
        <main className="mx-auto max-w-sm space-y-4 px-4 py-8">
          {/* Podium */}
          <div className="rounded-2xl border-2 border-yellow-400 bg-yellow-500/10 p-5 text-center">
            <p className="text-2xl">🥇</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-yellow-600">Vô địch</p>
            <p className="mt-1 text-lg font-black">{winners.map((id) => byId(id)?.name).join(" & ")}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 text-center">
            <p className="text-xl">🥈</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Á quân</p>
            <p className="mt-1 font-bold">{runners.map((id) => byId(id)?.name).join(" & ")}</p>
          </div>
          {config.hasThirdPlace && third.length > 0 && (
            <div className="rounded-2xl border bg-card p-4 text-center">
              <p className="text-xl">🥉</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Hạng 3 – 4</p>
              {third.map((id) => (
                <p key={id} className="mt-0.5 font-medium">{byId(id)?.name}</p>
              ))}
            </div>
          )}

          {/* Score summary */}
          <div className="rounded-xl border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Tỉ số chung kết</p>
            <p className="mt-1 font-mono text-3xl font-black tabular-nums">
              {finalMatch.scoreA} – {finalMatch.scoreB}
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => { if (confirm("Tạo giải mới? Dữ liệu cũ sẽ xoá.")) { actions.reset(); router.push("/quick/pic/new"); } }}
          >
            <RotateCcw className="size-4" />
            Tạo giải mới
          </Button>
        </main>
      </div>
    );
  }

  // ── Score overlay ─────────────────────────────────────────────────────────────
  if (activeMatch) {
    const target = activeMatch.stage === "group" ? config.targetGroup : config.targetKnockout;
    return (
      <ScoreOverlay
        match={activeMatch.match}
        players={players}
        target={target}
        onFinish={(a, b) => {
          if (activeMatch.stage === "group") actions.scoreGroup(activeMatch.match.id, a, b);
          else actions.scoreKnockout(activeMatch.match.id, a, b);
          setActiveMatch(null);
        }}
        onClose={() => setActiveMatch(null)}
      />
    );
  }

  // ── Stage: group / knockout ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <button onClick={() => { if (confirm("Huỷ giải và xoá dữ liệu?")) { actions.reset(); router.push("/quick/pic/new"); } }} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
            <RotateCcw className="size-4" />
          </button>
          <div className="flex flex-col items-center text-center">
            <span className="text-sm font-semibold">{config.name}</span>
            <span className="text-[10px] text-muted-foreground">
              {stage === "group" && `${pendingGroup.length} trận còn lại`}
              {stage === "knockout" && "Chung kết"}
            </span>
          </div>
          <Users className="size-4 text-muted-foreground" />
        </div>

        {/* Tabs — only in group stage */}
        {stage === "group" && (
          <div className="flex border-t">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-xl space-y-3 px-4 py-4">
        {/* Knockout stage */}
        {stage === "knockout" && finalMatch && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">🏆 Chung kết — chạm {config.targetKnockout} điểm</h2>
            <MatchCard
              match={finalMatch}
              players={players}
              onClick={() => setActiveMatch({ match: finalMatch, stage: "knockout" })}
            />
          </div>
        )}

        {/* Group stage: matches tab */}
        {stage === "group" && tab === "matches" && (
          <div className="space-y-2">
            {groupMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                players={players}
                onClick={() => setActiveMatch({ match: m, stage: "group" })}
              />
            ))}

            {allGroupDone && (
              <Button onClick={() => actions.advanceToDraw()} size="lg" className="mt-2 w-full">
                <Trophy className="size-4" />
                Xem kết quả & Bốc thăm chung kết
              </Button>
            )}
          </div>
        )}

        {/* Group stage: standings tab */}
        {stage === "group" && tab === "standings" && (
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Tên</th>
                  <th className="px-3 py-2 text-center">T</th>
                  <th className="px-3 py-2 text-center">B</th>
                  <th className="px-3 py-2 text-center">Hiệu số</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.playerId} className={`border-b last:border-0 ${i < 4 ? "" : "opacity-60"}`}>
                    <td className="px-3 py-2.5">
                      <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? "bg-yellow-400/20 text-yellow-600" :
                        i === 1 ? "bg-slate-300/20 text-slate-500" :
                        i === 2 ? "bg-orange-400/20 text-orange-600" :
                        i === 3 ? "bg-primary/10 text-primary" :
                        "bg-muted text-muted-foreground"
                      }`}>{s.rank}</span>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{s.name}</td>
                    <td className="px-3 py-2.5 text-center font-mono">{s.wins}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-muted-foreground">{s.losses}</td>
                    <td className={`px-3 py-2.5 text-center font-mono font-semibold ${s.diff > 0 ? "text-green-600" : s.diff < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                      {s.diff > 0 ? "+" : ""}{s.diff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {players.length > 4 && (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">
                Top 4 vào chung kết (hàng tối đậm)
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
