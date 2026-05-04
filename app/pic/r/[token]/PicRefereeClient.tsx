"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trophy, X } from "lucide-react";
import { type PicMatch, type PicPlayer } from "@/stores/pic-tournament";
import { scorePicMatch, createPicMatchScore } from "@/app/actions/pic";
import type { PicEventFull } from "@/app/actions/pic";
import { QuickScoreClient, type QuickScore } from "@/components/score/QuickScoreClient";
import { getSupabaseBrowser } from "@/lib/supabase/client";

function pairName(p1: PicPlayer | undefined, p2: PicPlayer | undefined) {
  return `${p1?.name ?? "?"} & ${p2?.name ?? "?"}`;
}

// ── PicMatchScore: bridge to QuickScoreClient ──────────────────────────────────

function PicMatchScore({
  match, players, target, token, eventId, onClose,
}: {
  match: PicMatch; players: PicPlayer[]; target: number;
  token: string; eventId: string; onClose: () => void;
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
      .channel(`pic-qs:${quickScore.code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quick_scores", filter: `code=eq.${quickScore.code}` },
        (payload: { new: QuickScore }) => {
          const updated = payload.new;
          if (updated.status === "completed") {
            startTransition(async () => {
              await scorePicMatch({
                eventId,
                matchId: match.id,
                scoreA: updated.score_a,
                scoreB: updated.score_b,
                token,
              });
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

// ── Match row ──────────────────────────────────────────────────────────────────

function MatchRow({ match, players, groupLabel, onClick, onDirectScore }: {
  match: PicMatch;
  players: PicPlayer[];
  groupLabel?: string;
  onClick: () => void;
  onDirectScore: (scoreA: number, scoreB: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftA, setDraftA] = useState("");
  const [draftB, setDraftB] = useState("");
  const [saving, setSaving] = useState(false);

  const byId = (id: string) => players.find((p) => p.id === id);
  const isDone = match.status === "completed";
  const aName = match.a1 ? pairName(byId(match.a1), byId(match.a2)) : "TBD";
  const bName = match.b1 ? pairName(byId(match.b1), byId(match.b2)) : "TBD";
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

  const save = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    await onDirectScore(Math.max(0, parseInt(draftA) || 0), Math.max(0, parseInt(draftB) || 0));
    setSaving(false);
    setEditing(false);
  };

  const cancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-primary/50 bg-card px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{aName} vs {bName}</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number" min={0} value={draftA}
              onChange={(e) => setDraftA(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-16 rounded-md border bg-background px-2 py-1.5 text-center font-mono text-base font-bold"
            />
            <span className="font-bold text-muted-foreground">–</span>
            <input
              type="number" min={0} value={draftB}
              onChange={(e) => setDraftB(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-16 rounded-md border bg-background px-2 py-1.5 text-center font-mono text-base font-bold"
            />
          </div>
        </div>
        <button
          onClick={save} disabled={saving}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Check className="size-4" />
        </button>
        <button
          onClick={cancel}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border hover:bg-accent"
        >
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
      {/* Group badge */}
      {groupLabel && (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          {groupLabel}
        </span>
      )}

      {/* Team A */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold leading-tight ${aWon ? "text-primary" : ""}`}>
          {aName}
          {aWon && <Trophy className="ml-1 inline size-3.5 text-primary" />}
        </p>
      </div>

      {/* vs */}
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">vs</span>

      {/* Team B */}
      <div className="min-w-0 flex-1 text-right">
        <p className={`truncate text-sm font-semibold leading-tight ${bWon ? "text-primary" : "text-muted-foreground"}`}>
          {bWon && <Trophy className="mr-1 inline size-3.5 text-primary" />}
          {bName}
        </p>
      </div>

      {/* Score */}
      <div className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-sm font-bold tabular-nums ${isDone ? "bg-secondary" : "border text-muted-foreground"}`}>
        {match.scoreA}–{match.scoreB}
      </div>

      {/* Pencil */}
      {canEdit && (
        <button
          onClick={openEdit}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground hover:border-primary/60 hover:text-primary"
        >
          <Pencil className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main referee client ────────────────────────────────────────────────────────

export default function PicRefereeClient({
  state,
  token,
  groupFilter,
}: {
  state: PicEventFull;
  token: string;
  groupFilter: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeMatch, setActiveMatch] = useState<PicMatch | null>(null);
  const { id: eventId, config, players, groups, knockoutMatches, stage } = state;

  // Tire = target score, editable per session (no DB persistence)
  const [tireGroup, setTireGroup] = useState<number>(config.targetGroup);
  const [tireKnockout, setTireKnockout] = useState<number>(config.targetKnockout);

  const target = (m: PicMatch) =>
    m.stage === "group" ? tireGroup : tireKnockout;

  const handleDirectScore = (matchId: string) => async (scoreA: number, scoreB: number) => {
    await scorePicMatch({ eventId, matchId, scoreA, scoreB, token });
    startTransition(() => { router.refresh(); });
  };

  if (activeMatch) {
    return (
      <PicMatchScore
        match={activeMatch}
        players={players}
        target={target(activeMatch)}
        token={token}
        eventId={eventId}
        onClose={() => setActiveMatch(null)}
      />
    );
  }

  const visibleGroups = groupFilter
    ? groups.filter((g) => g.label === groupFilter)
    : groups;

  const r16Matches = knockoutMatches.filter((m) => m.stage === "r16");
  const quarterMatches = knockoutMatches.filter((m) => m.stage === "quarterfinal");
  const semiMatches = knockoutMatches.filter((m) => m.stage === "semifinal");
  const finalMatch = knockoutMatches.find((m) => m.stage === "final");
  const thirdMatch = knockoutMatches.find((m) => m.stage === "third");

  const TireInput = ({ type }: { type: "group" | "knockout" }) => {
    const val = type === "group" ? tireGroup : tireKnockout;
    return (
      <input
        type="number" min={1} max={99} value={val}
        onChange={(e) => {
          const n = parseInt(e.target.value);
          if (n > 0) { type === "group" ? setTireGroup(n) : setTireKnockout(n); }
        }}
        className="w-9 rounded border bg-background px-1 py-0 text-center font-mono text-xs"
      />
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-center px-4">
          <div className="text-center">
            <p className="font-semibold">{config.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {groupFilter ? `Trọng tài Bảng ${groupFilter}` : "Trọng tài — không cần đăng nhập"}
            </p>
          </div>
        </div>
      </header>

      {/* Group tabs */}
      {!groupFilter && groups.length > 1 && stage === "group" && (
        <div className="border-b">
          <div className="mx-auto flex max-w-xl gap-1 overflow-x-auto px-4 py-2">
            {groups.map((g) => {
              const done = g.matches.filter((m) => m.status === "completed").length;
              const total = g.matches.length;
              return (
                <a key={g.id} href={`?g=${g.label}`}
                  className="flex shrink-0 flex-col items-center rounded-lg border px-4 py-2 text-center text-xs hover:bg-accent"
                >
                  <span className="font-bold">Bảng {g.label}</span>
                  <span className="text-muted-foreground">{done}/{total}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-xl space-y-5 px-4 py-4">
        {stage === "done" && (
          <div className="rounded-xl border bg-primary/5 p-6 text-center">
            <Trophy className="mx-auto mb-2 size-8 text-primary" />
            <p className="font-bold">Giải đấu đã kết thúc</p>
          </div>
        )}

        {stage === "group" && visibleGroups.map((g) => (
          <div key={g.id} className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bảng {g.label} — chạm <TireInput type="group" />
            </h2>
            {g.matches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                players={players}
                groupLabel={g.label}
                onClick={() => setActiveMatch(m)}
                onDirectScore={handleDirectScore(m.id)}
              />
            ))}
          </div>
        ))}

        {stage === "knockout" && (
          <>
            {r16Matches.length > 0 && (
              <div className="space-y-2">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vòng 1/16 — chạm <TireInput type="knockout" />
                </h2>
                {r16Matches.map((m, i) => (
                  <MatchRow key={m.id} match={m} players={players}
                    groupLabel={`1/16-${i + 1}`}
                    onClick={() => setActiveMatch(m)}
                    onDirectScore={handleDirectScore(m.id)}
                  />
                ))}
              </div>
            )}
            {quarterMatches.length > 0 && (
              <div className="space-y-2">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tứ kết — chạm <TireInput type="knockout" />
                </h2>
                {quarterMatches.map((m, i) => (
                  <MatchRow key={m.id} match={m} players={players}
                    groupLabel={`TK${i + 1}`}
                    onClick={() => setActiveMatch(m)}
                    onDirectScore={handleDirectScore(m.id)}
                  />
                ))}
              </div>
            )}
            {semiMatches.length > 0 && (
              <div className="space-y-2">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bán kết — chạm <TireInput type="knockout" />
                </h2>
                {semiMatches.map((m) => (
                  <MatchRow key={m.id} match={m} players={players}
                    onClick={() => setActiveMatch(m)}
                    onDirectScore={handleDirectScore(m.id)}
                  />
                ))}
              </div>
            )}
            {finalMatch && (
              <div className="space-y-2">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  🏆 Chung kết — chạm <TireInput type="knockout" />
                </h2>
                <MatchRow match={finalMatch} players={players}
                  onClick={() => setActiveMatch(finalMatch)}
                  onDirectScore={handleDirectScore(finalMatch.id)}
                />
              </div>
            )}
            {thirdMatch && (
              <div className="space-y-2">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tranh hạng 3–4 — chạm <TireInput type="knockout" />
                </h2>
                <MatchRow match={thirdMatch} players={players}
                  onClick={() => setActiveMatch(thirdMatch)}
                  onDirectScore={handleDirectScore(thirdMatch.id)}
                />
              </div>
            )}
          </>
        )}

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
