"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy, Shuffle, CheckCircle2, Check, Pencil, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeStandings, type PicMatch, type PicPlayer, type PicGroup } from "@/stores/pic-tournament";
import { scorePicMatch, picDrawKnockout, picAdvanceToDraw, createPicMatchScore } from "@/app/actions/pic";
import { buildDrawPairs, DRAW_MODES, type DrawMode } from "@/lib/pic-draw";
import type { PicEventFull } from "@/app/actions/pic";
import { QuickScoreClient, type QuickScore } from "@/components/score/QuickScoreClient";
import { getSupabaseBrowser } from "@/lib/supabase/client";

// ── helpers ────────────────────────────────────────────────────────────────────

function pairName(p1: PicPlayer | undefined, p2: PicPlayer | undefined) {
  return `${p1?.name ?? "?"} & ${p2?.name ?? "?"}`;
}

// ── AdminMatchScore: QuickScoreClient bridge (no referee token needed) ─────────

function AdminMatchScore({
  match, players, target, eventId, onClose,
}: {
  match: PicMatch; players: PicPlayer[]; target: number;
  eventId: string; onClose: () => void;
}) {
  const router = useRouter();
  const [quickScore, setQuickScore] = useState<QuickScore | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const byId = (id: string) => players.find((p) => p.id === id);
  const aName = pairName(byId(match.a1), byId(match.a2));
  const bName = pairName(byId(match.b1), byId(match.b2));
  const stageLabel =
    match.stage === "group" ? `Trận ${match.round}` :
    match.stage === "semifinal" ? "Bán kết" :
    match.stage === "third" ? "Tranh 3–4" : "Chung kết";

  useEffect(() => {
    createPicMatchScore({ teamAName: aName, teamBName: bName, targetPoints: target, title: stageLabel })
      .then((res) => {
        if ("error" in res) { setCreateError(res.error); return; }
        setQuickScore({
          code: res.code,
          team_a_name: aName,
          team_b_name: bName,
          score_a: 0,
          score_b: 0,
          status: "pending",
          winner: null,
          target_points: target,
          title: stageLabel,
          updated_at: new Date().toISOString(),
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!quickScore) return;
    const sb = getSupabaseBrowser();
    const ch = sb
      .channel(`admin-qs:${quickScore.code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quick_scores", filter: `code=eq.${quickScore.code}` },
        (payload: { new: QuickScore }) => {
          const updated = payload.new;
          if (updated.status === "completed") {
            startTransition(async () => {
              await scorePicMatch({ eventId, matchId: match.id, scoreA: updated.score_a, scoreB: updated.score_b });
              onClose();
              router.refresh();
            });
          }
        },
      )
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickScore?.code]);

  if (createError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-6">
        <div className="space-y-3 text-center">
          <p className="text-destructive">{createError}</p>
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Quay lại</button>
        </div>
      </div>
    );
  }

  if (!quickScore) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <p className="animate-pulse text-sm text-muted-foreground">Đang tạo trận…</p>
      </div>
    );
  }

  return <QuickScoreClient initial={quickScore} onBack={onClose} />;
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

function StandingsTable({ group, players, advancePerGroup, pointsForWin, pointsForLoss, tiebreakerOrder }: {
  group: PicGroup; players: PicPlayer[]; advancePerGroup: number;
  pointsForWin: number; pointsForLoss: number;
  tiebreakerOrder?: "diff_first" | "wins_first";
}) {
  const gPlayers = group.playerIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is PicPlayer => !!p);
  const standings = computeStandings(gPlayers, group.matches, pointsForWin, pointsForLoss, tiebreakerOrder);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b bg-muted/40 px-3 py-2 text-xs font-bold text-primary">
        Bảng {group.label}
        <span className="ml-2 font-normal text-muted-foreground">T+{pointsForWin} B+{pointsForLoss}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Tên</th>
            <th className="px-3 py-2 text-center">Điểm</th>
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
              <td className="px-3 py-2.5 text-center font-mono font-bold text-primary">{s.pts}</td>
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
  const [drawMode, setDrawMode] = useState<DrawMode>("random_all");

  const { id: eventId, config, players, groups, knockoutMatches, stage } = state;
  const byId = (id: string) => players.find((p) => p.id === id);
  const multiGroup = groups.length > 1;
  const allGroupDone = groups.every((g) => g.matches.every((m) => m.status === "completed"));
  const pendingCount = groups.reduce((s, g) => s + g.matches.filter((m) => m.status === "pending").length, 0);

  const W = config.pointsForWin ?? 2;
  const L = config.pointsForLoss ?? 0;
  const TB = config.tiebreakerOrder ?? "diff_first";

  const advancingByGroup = groups.map((g) => {
    const gPlayers = g.playerIds.map((id) => players.find((p) => p.id === id)).filter((p): p is PicPlayer => !!p);
    return computeStandings(gPlayers, g.matches, W, L, TB).slice(0, config.advancePerGroup).map((s) => s.playerId);
  });
  const advancingIds = advancingByGroup.flat();

  const doDraw = () => setDrawnPairs(buildDrawPairs(drawMode, advancingByGroup));

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
                const top = computeStandings(gPlayers, g.matches, W, L, TB).slice(0, config.advancePerGroup);
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

            {/* Draw mode selector */}
            <div className="space-y-1.5">
              {DRAW_MODES.filter((m) => multiGroup || m.value === "random_all").map((m) => (
                <button key={m.value} onClick={() => { setDrawMode(m.value); setDrawnPairs(null); }}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    drawMode === m.value ? "border-primary bg-primary/10" : "hover:border-primary/50"
                  }`}>
                  <p className={`text-sm font-semibold ${drawMode === m.value ? "text-primary" : ""}`}>{m.label}</p>
                  <p className="text-[11px] text-muted-foreground">{m.desc}</p>
                </button>
              ))}
            </div>

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
    const doneKoSemis = knockoutMatches.filter((m) => m.stage === "semifinal");
    if (!finalMatch) return null;
    const aWon = finalMatch.scoreA > finalMatch.scoreB;
    const champs = aWon ? [finalMatch.a1, finalMatch.a2] : [finalMatch.b1, finalMatch.b2];
    const runners = aWon ? [finalMatch.b1, finalMatch.b2] : [finalMatch.a1, finalMatch.a2];

    const KoRow = ({ match, label }: { match: PicMatch; label: string }) => {
      const mAWon = match.scoreA > match.scoreB;
      return (
        <div className="rounded-xl border bg-card px-3 py-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className={`flex-1 truncate ${mAWon ? "font-bold" : "text-muted-foreground"}`}>
              {[match.a1, match.a2].map((id) => byId(id)?.name).join(" & ")}
            </span>
            <span className="shrink-0 font-mono font-black tabular-nums">
              {match.scoreA} – {match.scoreB}
            </span>
            <span className={`flex-1 truncate text-right ${!mAWon ? "font-bold" : "text-muted-foreground"}`}>
              {[match.b1, match.b2].map((id) => byId(id)?.name).join(" & ")}
            </span>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6 py-2">
        {/* Podium */}
        <div className="mx-auto max-w-sm space-y-3">
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
        </div>

        {/* Knockout results */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vòng trung kết</h2>
          {doneKoSemis.map((m, i) => <KoRow key={m.id} match={m} label={`Bán kết ${i + 1}`} />)}
          {thirdMatch && thirdMatch.status === "completed" && <KoRow match={thirdMatch} label="Tranh hạng 3–4" />}
          <KoRow match={finalMatch} label="Chung kết" />
        </div>

        {/* Group standings + match results */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thống kê vòng bảng</h2>
          {groups.map((g) => (
            <div key={g.id} className="space-y-2">
              <StandingsTable group={g} players={players} advancePerGroup={config.advancePerGroup} pointsForWin={W} pointsForLoss={L} tiebreakerOrder={TB} />
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  Kết quả trận — Bảng {g.label}
                </div>
                {g.matches.filter((m) => m.status === "completed").map((m) => {
                  const mAWon = m.scoreA > m.scoreB;
                  return (
                    <div key={m.id} className="flex items-center gap-2 border-b px-3 py-2 last:border-0 text-xs">
                      <span className="w-12 shrink-0 text-muted-foreground">Vòng {m.round}</span>
                      <span className={`flex-1 truncate ${mAWon ? "font-semibold" : "text-muted-foreground"}`}>
                        {[m.a1, m.a2].map((id) => byId(id)?.name).join(" & ")}
                      </span>
                      <span className="shrink-0 font-mono font-bold tabular-nums">
                        {m.scoreA} – {m.scoreB}
                      </span>
                      <span className={`flex-1 truncate text-right ${!mAWon ? "font-semibold" : "text-muted-foreground"}`}>
                        {[m.b1, m.b2].map((id) => byId(id)?.name).join(" & ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Score overlay ─────────────────────────────────────────────────────────────
  if (activeMatch) {
    const target = activeMatch.stage === "group" ? config.targetGroup : config.targetKnockout;
    return (
      <AdminMatchScore
        match={activeMatch.match}
        players={players}
        target={target}
        eventId={eventId}
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
            <Button disabled={pending} onClick={() => { startTransition(async () => { await picAdvanceToDraw(eventId); router.refresh(); }); }} size="lg" className="mt-2 w-full">
              <Trophy className="size-4" />{pending ? "Đang xử lý…" : "Xem kết quả & Bốc thăm"}
            </Button>
          )}
        </div>
      )}

      {stage === "group" && viewTab === "standings" && (
        <div className="space-y-4">
          {groups.map((g) => (
            <StandingsTable key={g.id} group={g} players={players} advancePerGroup={config.advancePerGroup} pointsForWin={W} pointsForLoss={L} tiebreakerOrder={TB} />
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
