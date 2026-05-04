"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy, ChevronLeft, Shuffle, CheckCircle2,
  Plus, Minus, Check, Pencil, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeStandings, type PicMatch, type PicPlayer, type PicGroup } from "@/stores/pic-tournament";
import { scorePicMatch, picDrawKnockout } from "@/app/actions/pic";
import type { PicEventFull } from "@/app/actions/pic";

// ── helpers ────────────────────────────────────────────────────────────────────

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

// ── ScoreOverlay ───────────────────────────────────────────────────────────────

function ScoreOverlay({
  match, players, target, onFinish, onClose,
}: {
  match: PicMatch; players: PicPlayer[]; target: number;
  onFinish: (a: number, b: number) => void; onClose: () => void;
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
            <button onClick={() => onFinish(armed[0], armed[1])}
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

// ── MatchCard ──────────────────────────────────────────────────────────────────

function MatchCard({ match, players, groupLabel, onClick, onDirectScore }: {
  match: PicMatch; players: PicPlayer[]; groupLabel?: string;
  onClick?: () => void; onDirectScore?: (scoreA: number, scoreB: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftA, setDraftA] = useState("");
  const [draftB, setDraftB] = useState("");

  const byId = (id: string) => players.find((p) => p.id === id);
  const aName = match.a1 ? pairName(byId(match.a1), byId(match.a2)) : "TBD";
  const bName = match.b1 ? pairName(byId(match.b1), byId(match.b2)) : "TBD";
  const isDone = match.status === "completed";
  const aWon = isDone && match.scoreA > match.scoreB;
  const bWon = isDone && match.scoreB > match.scoreA;
  const canPlay = !isDone && !!match.a1 && !!match.b1;
  const canEdit = !!match.a1 && !!match.b1;

  const openEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftA(String(match.scoreA));
    setDraftB(String(match.scoreB));
    setEditing(true);
  };

  const save = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDirectScore?.(Math.max(0, parseInt(draftA) || 0), Math.max(0, parseInt(draftB) || 0));
    setEditing(false);
  };

  const cancel = (e: React.MouseEvent) => { e.stopPropagation(); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-primary/50 bg-card px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{aName} vs {bName}</p>
          <div className="mt-2 flex items-center gap-2">
            <input type="number" min={0} value={draftA}
              onChange={(e) => setDraftA(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-16 rounded-md border bg-background px-2 py-1.5 text-center font-mono text-base font-bold"
            />
            <span className="font-bold text-muted-foreground">–</span>
            <input type="number" min={0} value={draftB}
              onChange={(e) => setDraftB(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-16 rounded-md border bg-background px-2 py-1.5 text-center font-mono text-base font-bold"
            />
          </div>
        </div>
        <button onClick={save}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Check className="size-4" />
        </button>
        <button onClick={cancel}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border hover:bg-accent">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border bg-card px-3 py-3 transition-colors ${
        canPlay ? "cursor-pointer hover:border-primary/50 hover:bg-accent/30 active:scale-[0.99]" : ""
      } ${!canEdit ? "opacity-40" : ""}`}
      onClick={canPlay ? onClick : undefined}
    >
      {groupLabel && (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          {groupLabel}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold leading-tight ${aWon ? "text-primary" : ""}`}>
          {aName}{aWon && <Trophy className="ml-1 inline size-3.5 text-primary" />}
        </p>
      </div>
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">vs</span>
      <div className="min-w-0 flex-1 text-right">
        <p className={`truncate text-sm font-semibold leading-tight ${bWon ? "text-primary" : "text-muted-foreground"}`}>
          {bWon && <Trophy className="mr-1 inline size-3.5 text-primary" />}{bName}
        </p>
      </div>
      <div className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-sm font-bold tabular-nums ${isDone ? "bg-secondary" : "border text-muted-foreground"}`}>
        {match.scoreA}–{match.scoreB}
      </div>
      {canEdit && onDirectScore && (
        <button onClick={openEdit}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground hover:border-primary/60 hover:text-primary">
          <Pencil className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ── StandingsTable ─────────────────────────────────────────────────────────────

function StandingsTable({ group, players, advancePerGroup }: {
  group: PicGroup; players: PicPlayer[]; advancePerGroup: number;
}) {
  const gPlayers = group.playerIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is PicPlayer => !!p);
  const standings = computeStandings(gPlayers, group.matches);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b bg-muted/40 px-3 py-2 text-xs font-bold text-primary">Bảng {group.label}</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Tên</th>
            <th className="px-3 py-2 text-center">T</th>
            <th className="px-3 py-2 text-center">B</th>
            <th className="px-3 py-2 text-center">±</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.playerId} className={`border-b last:border-0 ${i >= advancePerGroup ? "opacity-50" : ""}`}>
              <td className="px-3 py-2.5">
                <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0 ? "bg-yellow-400/20 text-yellow-600" :
                  i === 1 ? "bg-slate-300/20 text-slate-500" :
                  i < advancePerGroup ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
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
    </div>
  );
}

// ── Main client ────────────────────────────────────────────────────────────────

export default function PicEventClient({ state }: { state: PicEventFull }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeMatch, setActiveMatch] = useState<{
    match: PicMatch; groupId?: string; stage: "group" | "knockout";
  } | null>(null);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [viewTab, setViewTab] = useState<"matches" | "standings">("matches");
  const [drawnPairs, setDrawnPairs] = useState<[string, string][] | null>(null);

  const { id: eventId, config, players, groups, knockoutMatches, stage } = state;
  const byId = (id: string) => players.find((p) => p.id === id);
  const multiGroup = groups.length > 1;
  const allGroupDone = groups.every((g) => g.matches.every((m) => m.status === "completed"));
  const pendingCount = groups.reduce((s, g) => s + g.matches.filter((m) => m.status === "pending").length, 0);

  const advancingIds = groups.flatMap((g) => {
    const gPlayers = g.playerIds.map((id) => players.find((p) => p.id === id)).filter((p): p is PicPlayer => !!p);
    return computeStandings(gPlayers, g.matches).slice(0, config.advancePerGroup).map((s) => s.playerId);
  });

  const doDraw = () => {
    const shuffled = shuffle(advancingIds);
    const pairs: [string, string][] = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) pairs.push([shuffled[i]!, shuffled[i + 1]!]);
    setDrawnPairs(pairs);
  };

  const handleScore = (scoreA: number, scoreB: number) => {
    if (!activeMatch) return;
    startTransition(async () => {
      await scorePicMatch({ eventId, matchId: activeMatch.match.id, scoreA, scoreB });
      setActiveMatch(null);
      router.refresh();
    });
  };

  const handleDirectScore = (matchId: string) => (scoreA: number, scoreB: number) => {
    startTransition(async () => {
      await scorePicMatch({ eventId, matchId, scoreA, scoreB });
      router.refresh();
    });
  };

  // ── Draw stage ───────────────────────────────────────────────────────────────
  if (stage === "draw") {
    const matchups: { a: [string, string]; b: [string, string] }[] = [];
    if (drawnPairs) {
      for (let i = 0; i < drawnPairs.length - 1; i += 2)
        matchups.push({ a: drawnPairs[i]!, b: drawnPairs[i + 1]! });
    }
    return (
      <div className="space-y-5">
          <div className="rounded-xl border bg-primary/5 p-4 text-center">
            <Trophy className="mx-auto mb-2 size-8 text-primary" />
            <p className="font-bold">Vòng bảng hoàn thành!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {advancingIds.length} người vào {advancingIds.length <= 4 ? "chung kết" : "bán kết"}
            </p>
          </div>

          {multiGroup && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Người đi tiếp</h2>
              {groups.map((g) => {
                const gPlayers = g.playerIds.map((id) => players.find((p) => p.id === id)).filter((p): p is PicPlayer => !!p);
                const top = computeStandings(gPlayers, g.matches).slice(0, config.advancePerGroup);
                return (
                  <div key={g.id} className="rounded-xl border bg-card px-3 py-2">
                    <p className="mb-1 text-xs font-bold text-primary">Bảng {g.label}</p>
                    {top.map((s) => (
                      <div key={s.playerId} className="flex items-center gap-2 py-0.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{s.rank}</span>
                        <span className="flex-1 text-sm">{s.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{s.wins}T {s.diff > 0 ? "+" : ""}{s.diff}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bốc thăm cặp đôi</h2>
            <Button onClick={doDraw} variant="outline" className="w-full">
              <Shuffle className="size-4" />{drawnPairs ? "Bốc thăm lại" : "Bốc thăm ngẫu nhiên"}
            </Button>
            {drawnPairs && matchups.map((mu, i) => (
              <div key={i} className="rounded-xl border bg-card p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {matchups.length > 1 ? `Bán kết ${i + 1}` : "Chung kết"}
                </p>
                <div className="space-y-1.5">
                  {([mu.a, mu.b] as [string, string][]).map((pair, pi) => (
                    <div key={pi} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${pi === 0 ? "bg-blue-500/10" : "bg-orange-500/10"}`}>
                      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${pi === 0 ? "bg-blue-500/20 text-blue-600" : "bg-orange-500/20 text-orange-600"}`}>
                        {pi === 0 ? "A" : "B"}
                      </span>
                      <span className="flex-1 text-sm font-semibold">{pair.map((id) => byId(id)?.name).join(" & ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {drawnPairs && (
            <Button disabled={pending} onClick={() => {
              startTransition(async () => {
                await picDrawKnockout(eventId, drawnPairs);
                router.refresh();
              });
            }} size="lg" className="w-full">
              <CheckCircle2 className="size-4" />
              {pending ? "Đang lưu…" : "Xác nhận & Bắt đầu"}
            </Button>
          )}
      </div>
    );
  }

  // ── Done stage ───────────────────────────────────────────────────────────────
  if (stage === "done") {
    const finalMatch = knockoutMatches.find((m) => m.stage === "final");
    const thirdMatch = knockoutMatches.find((m) => m.stage === "third");
    if (!finalMatch) return null;
    const aWon = finalMatch.scoreA > finalMatch.scoreB;
    const champs = aWon ? [finalMatch.a1, finalMatch.a2] : [finalMatch.b1, finalMatch.b2];
    const runners = aWon ? [finalMatch.b1, finalMatch.b2] : [finalMatch.a1, finalMatch.a2];
    return (
      <div className="mx-auto max-w-sm space-y-4 py-4">
        <h2 className="text-center text-xl font-bold">🏆 Kết quả</h2>
        <div className="rounded-2xl border-2 border-yellow-400 bg-yellow-500/10 p-5 text-center">
          <p className="text-2xl">🥇</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-yellow-600">Vô địch</p>
          <p className="mt-1 text-lg font-black">{champs.map((id) => byId(id)?.name).join(" & ")}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 text-center">
          <p className="text-xl">🥈</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Á quân</p>
          <p className="mt-1 font-bold">{runners.map((id) => byId(id)?.name).join(" & ")}</p>
        </div>
        {thirdMatch && thirdMatch.status === "completed" && (() => {
          const t3Won = thirdMatch.scoreA > thirdMatch.scoreB;
          const third = t3Won ? [thirdMatch.a1, thirdMatch.a2] : [thirdMatch.b1, thirdMatch.b2];
          return (
            <div className="rounded-2xl border bg-card p-4 text-center">
              <p className="text-xl">🥉</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Hạng 3</p>
              <p className="mt-0.5 font-bold">{third.map((id) => byId(id)?.name).join(" & ")}</p>
            </div>
          );
        })()}
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Tỉ số chung kết</p>
          <p className="mt-1 font-mono text-3xl font-black tabular-nums">{finalMatch.scoreA} – {finalMatch.scoreB}</p>
        </div>
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
        onFinish={handleScore}
        onClose={() => setActiveMatch(null)}
      />
    );
  }

  // ── Group / knockout ──────────────────────────────────────────────────────────
  const semiMatches = knockoutMatches.filter((m) => m.stage === "semifinal");
  const finalMatchKO = knockoutMatches.find((m) => m.stage === "final");
  const thirdMatchKO = knockoutMatches.find((m) => m.stage === "third");

  type TabId = number | "standings";
  const allTabs: { id: TabId; label: string }[] = multiGroup
    ? [...groups.map((g, i) => ({ id: i as TabId, label: `Bảng ${g.label}` })), { id: "standings", label: "Xếp hạng" }]
    : [{ id: 0, label: "Trận đấu" }, { id: "standings", label: "Bảng điểm" }];
  const activeTabId: TabId = viewTab === "standings" ? "standings" : activeGroupIdx;
  const activeGroup = groups[activeGroupIdx];

  return (
    <div className="space-y-3">
      {stage === "group" && (
        <div className="flex overflow-x-auto border-b">
          {allTabs.map((t) => (
            <button key={String(t.id)}
              onClick={() => {
                if (t.id === "standings") setViewTab("standings");
                else { setActiveGroupIdx(t.id as number); setViewTab("matches"); }
              }}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTabId === t.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {stage === "knockout" && (
        <div className="space-y-4">
          {semiMatches.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bán kết — chạm {config.targetKnockout}</h2>
              {semiMatches.map((m) => (
                <MatchCard key={m.id} match={m} players={players}
                  onClick={() => setActiveMatch({ match: m, stage: "knockout" })}
                  onDirectScore={handleDirectScore(m.id)} />
              ))}
            </div>
          )}
          {finalMatchKO && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">🏆 Chung kết — chạm {config.targetKnockout}</h2>
              <MatchCard match={finalMatchKO} players={players}
                onClick={() => setActiveMatch({ match: finalMatchKO, stage: "knockout" })}
                onDirectScore={handleDirectScore(finalMatchKO.id)} />
            </div>
          )}
          {thirdMatchKO && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tranh hạng 3–4 — chạm {config.targetKnockout}</h2>
              <MatchCard match={thirdMatchKO} players={players}
                onClick={() => setActiveMatch({ match: thirdMatchKO, stage: "knockout" })}
                onDirectScore={handleDirectScore(thirdMatchKO.id)} />
            </div>
          )}
        </div>
      )}

      {stage === "group" && viewTab === "matches" && activeGroup && (
        <div className="space-y-2">
          {activeGroup.matches.map((m) => (
            <MatchCard key={m.id} match={m} players={players}
              groupLabel={activeGroup.label}
              onClick={() => setActiveMatch({ match: m, groupId: activeGroup.id, stage: "group" })}
              onDirectScore={handleDirectScore(m.id)} />
          ))}
          {allGroupDone && (
            <Button onClick={() => { startTransition(async () => { router.refresh(); }); }} size="lg" className="mt-2 w-full">
              <Trophy className="size-4" />Xem kết quả &amp; Bốc thăm
            </Button>
          )}
        </div>
      )}

      {stage === "group" && viewTab === "standings" && (
        <div className="space-y-4">
          {groups.map((g) => (
            <StandingsTable key={g.id} group={g} players={players} advancePerGroup={config.advancePerGroup} />
          ))}
          {allGroupDone && (
            <Button onClick={() => { startTransition(async () => { router.refresh(); }); }} size="lg" className="w-full">
              <Trophy className="size-4" />Xem kết quả &amp; Bốc thăm
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
