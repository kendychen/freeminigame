"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Trophy } from "lucide-react";
import { type PicMatch, type PicPlayer } from "@/stores/pic-tournament";
import { scorePicMatch, createPicMatchScore } from "@/app/actions/pic";
import type { PicEventFull } from "@/app/actions/pic";
import { QuickScoreClient, type QuickScore } from "@/app/score/[code]/QuickScoreClient";
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
  groupFilter,
}: {
  state: PicEventFull;
  token: string;
  groupFilter: string | null;
}) {
  const [activeMatch, setActiveMatch] = useState<PicMatch | null>(null);
  const { id: eventId, config, players, groups, knockoutMatches, stage } = state;

  const target = (m: PicMatch) =>
    m.stage === "group" ? config.targetGroup : config.targetKnockout;

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

  // Filter groups if groupFilter is set
  const visibleGroups = groupFilter
    ? groups.filter((g) => g.label === groupFilter)
    : groups;

  const semiMatches = knockoutMatches.filter((m) => m.stage === "semifinal");
  const finalMatch = knockoutMatches.find((m) => m.stage === "final");
  const thirdMatch = knockoutMatches.find((m) => m.stage === "third");

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

      {/* Group tabs (when multiple groups and no filter) */}
      {!groupFilter && groups.length > 1 && stage === "group" && (
        <div className="border-b">
          <div className="mx-auto flex max-w-xl gap-1 overflow-x-auto px-4 py-2">
            {groups.map((g) => {
              const done = g.matches.filter((m) => m.status === "completed").length;
              const total = g.matches.length;
              return (
                <a
                  key={g.id}
                  href={`?g=${g.label}`}
                  className="flex shrink-0 flex-col items-center rounded-lg border px-4 py-2 text-center text-xs hover:bg-accent"
                >
                  <span className="font-bold">Bảng {g.label}</span>
                  <span className="text-muted-foreground">{done}/{total} trận</span>
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
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bảng {g.label} — chạm {config.targetGroup}
            </h2>
            {g.matches.map((m) => (
              <MatchRow key={m.id} match={m} players={players} onClick={() => setActiveMatch(m)} />
            ))}
          </div>
        ))}

        {stage === "knockout" && (
          <>
            {semiMatches.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bán kết — chạm {config.targetKnockout}
                </h2>
                {semiMatches.map((m) => (
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
