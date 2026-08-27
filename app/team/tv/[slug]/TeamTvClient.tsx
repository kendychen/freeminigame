"use client";

import { useMemo } from "react";
import { loadTeamTvState } from "@/app/actions/team";
import { computeTeamStandings } from "@/lib/team/standings";
import { CATEGORY_LABELS } from "@/lib/team/types";
import type { DbTeamPlayer, DbTeamRubber, DbTeamTie, TeamEventFull, TieStage } from "@/lib/team/types";
import { TvShell, TvCard, TvMatchRow, TvStandings, type TvScreen } from "@/components/tv/TvShell";
import { useTvFeed, useRecentlyCompleted } from "@/components/tv/useTvFeed";

const TIE_STAGE_LABEL: Record<TieStage, string> = {
  group: "Vòng bảng",
  r16: "Vòng 1/8",
  quarterfinal: "Tứ kết",
  semifinal: "Bán kết",
  final: "Chung kết",
  third: "Tranh hạng 3",
};

function rubberLabel(rubbers: DbTeamRubber[], rubber: DbTeamRubber): string {
  const sameCat = rubbers.filter((r) => r.category === rubber.category);
  const base = CATEGORY_LABELS[rubber.category];
  return sameCat.length <= 1 ? base : `${base} #${sameCat.findIndex((r) => r.id === rubber.id) + 1}`;
}

function sideNames(players: DbTeamPlayer[], id1: string | null, id2: string | null): string | null {
  const names = [id1, id2]
    .filter((id): id is string => !!id)
    .map((id) => players.find((p) => p.id === id)?.name ?? "?");
  return names.length ? names.join(" + ") : null;
}

function TieBoard({
  tie,
  rubbers,
  nameA,
  nameB,
  players,
  recent,
  compact,
}: {
  tie: DbTeamTie;
  rubbers: DbTeamRubber[];
  nameA: string;
  nameB: string;
  players: DbTeamPlayer[];
  recent: Set<string>;
  compact: boolean;
}) {
  const done = tie.status === "completed";
  const inPlay = !done && rubbers.some((r) => r.status !== "pending");
  return (
    <div className={`flex h-full flex-col rounded-2xl border p-4 ${inPlay ? "border-red-500/40 bg-red-500/10" : done ? "border-white/10 bg-white/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
      <div className="flex items-center justify-between text-base text-zinc-400">
        <span className="font-bold uppercase tracking-wide">
          {inPlay && <span className="mr-2 inline-block size-2.5 animate-pulse rounded-full bg-red-500" />}
          {tie.stage === "group" ? `Bảng ${tie.group_label ?? ""} · Vòng ${tie.round}` : TIE_STAGE_LABEL[tie.stage]}
        </span>
        <span>{done ? "Kết thúc" : inPlay ? "Đang đấu" : "Chưa đấu"}</span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <p className={`truncate ${compact ? "text-2xl" : "text-3xl"} ${done && tie.winner_squad_id === tie.squad_a_id ? "font-black" : "font-semibold"}`}>{nameA}</p>
        <p className={`font-mono font-black tabular-nums ${compact ? "text-4xl" : "text-6xl"}`}>
          {tie.rubbers_won_a}
          <span className="mx-2 text-zinc-600">:</span>
          {tie.rubbers_won_b}
        </p>
        <p className={`truncate text-right ${compact ? "text-2xl" : "text-3xl"} ${done && tie.winner_squad_id === tie.squad_b_id ? "font-black" : "font-semibold"}`}>{nameB}</p>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10">
        {rubbers.map((r) => {
          const isDone = r.status === "completed";
          const wo = r.status === "walkover";
          const a = sideNames(players, r.a1_id, r.a2_id) ?? "Chưa xếp";
          const b = sideNames(players, r.b1_id, r.b2_id) ?? "Chưa xếp";
          if (wo) {
            return (
              <div key={r.id} className="flex items-center gap-3 border-b border-white/10 px-4 py-2 text-lg text-zinc-400 last:border-0">
                <span className="w-32 shrink-0">{rubberLabel(rubbers, r)}</span>
                <span className="flex-1 truncate">{r.walkover_winner ? `W.O. — xử thắng ${r.walkover_winner === "a" ? nameA : nameB}` : "Đã hủy"}</span>
              </div>
            );
          }
          return (
            <TvMatchRow
              key={r.id}
              meta={rubberLabel(rubbers, r)}
              a={a}
              b={b}
              scoreA={r.score_a}
              scoreB={r.score_b}
              done={isDone}
              fresh={recent.has(r.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function TeamTvClient({ initial }: { initial: TeamEventFull }) {
  const eventId = initial.event.id;
  const { data, conn, updatedAt } = useTvFeed<TeamEventFull>({
    key: `team:${eventId}`,
    initial,
    tables: [
      { table: "team_ties", filter: `event_id=eq.${eventId}` },
      { table: "team_rubbers", filter: `event_id=eq.${eventId}` },
    ],
    refetch: () => loadTeamTvState(eventId),
  });
  const { event, squads, players, ties, rubbers } = data;

  const squadName = (id: string | null) => squads.find((s) => s.id === id)?.name ?? "?";
  const rubbersOf = (tieId: string) => rubbers.filter((r) => r.tie_id === tieId);

  const completedRubberIds = useMemo(
    () => rubbers.filter((r) => r.status !== "pending").map((r) => r.id),
    [rubbers],
  );
  const { recent, banner } = useRecentlyCompleted(completedRubberIds);
  const bannerNode = useMemo(() => {
    if (!banner) return null;
    const r = rubbers.find((x) => x.id === banner);
    const tie = r && ties.find((t) => t.id === r.tie_id);
    if (!r || !tie) return null;
    if (r.status === "walkover") return `${CATEGORY_LABELS[r.category]}: xử thắng ${r.walkover_winner === "a" ? squadName(tie.squad_a_id) : squadName(tie.squad_b_id)}`;
    return `${CATEGORY_LABELS[r.category]}: ${squadName(tie.squad_a_id)} ${r.score_a} – ${r.score_b} ${squadName(tie.squad_b_id)} · tỷ số trận ${tie.rubbers_won_a}–${tie.rubbers_won_b}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner, rubbers, ties, squads]);

  const screens: TvScreen[] = [];

  // ── In progress ──
  const inPlay = ties.filter((t) => t.status === "pending" && rubbersOf(t.id).some((r) => r.status !== "pending"));
  if (inPlay.length > 0) {
    const shown = inPlay.slice(0, 2);
    screens.push({
      key: "live",
      label: "Đang đấu",
      node: (
        <div className={`grid h-full gap-5 ${shown.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {shown.map((t) => (
            <TieBoard
              key={t.id}
              tie={t}
              rubbers={rubbersOf(t.id)}
              nameA={squadName(t.squad_a_id)}
              nameB={squadName(t.squad_b_id)}
              players={players}
              recent={recent}
              compact={shown.length > 1}
            />
          ))}
        </div>
      ),
    });
  }

  // ── Groups ──
  const groupLabels = Array.from(new Set(squads.map((s) => s.group_label).filter((g): g is string => !!g))).sort();
  const groupKeys: (string | null)[] = groupLabels.length ? groupLabels : [null];
  for (const g of groupKeys) {
    const gSquads = g ? squads.filter((s) => s.group_label === g) : squads;
    const gTies = ties.filter((t) => t.stage === "group" && (g ? t.group_label === g : true));
    if (gSquads.length === 0) continue;
    const standings = computeTeamStandings(gSquads, gTies, rubbers);
    const done = gTies.filter((t) => t.status === "completed");
    const pending = gTies.filter((t) => t.status === "pending");
    const rows = [...done.slice(-5), ...pending.slice(0, Math.max(0, 8 - Math.min(done.length, 5)))];
    screens.push({
      key: `group:${g ?? "all"}`,
      label: g ? `Bảng ${g}` : "Xếp hạng",
      node: (
        <div className="grid h-full grid-cols-[1.15fr_1fr] gap-5">
          <TvCard title={g ? `Bảng ${g} · Xếp hạng` : "Bảng xếp hạng"}>
            <TvStandings
              head={["#", "Đội", "Trận", "T-B", "HS trận", "HS điểm"]}
              rows={standings.map((s) => ({
                id: s.squadId,
                cells: [
                  s.rank,
                  s.name,
                  s.played,
                  `${s.tiesWon}-${s.tiesLost}`,
                  s.rubberDiff > 0 ? `+${s.rubberDiff}` : s.rubberDiff,
                  s.pointDiff > 0 ? `+${s.pointDiff}` : s.pointDiff,
                ],
              }))}
            />
          </TvCard>
          <TvCard title={`Các trận · ${done.length}/${gTies.length}`}>
            {rows.map((t) => {
              const rs = rubbersOf(t.id);
              const started = rs.some((r) => r.status !== "pending");
              return (
                <TvMatchRow
                  key={t.id}
                  meta={`Vòng ${t.round}`}
                  a={squadName(t.squad_a_id)}
                  b={squadName(t.squad_b_id)}
                  scoreA={t.rubbers_won_a}
                  scoreB={t.rubbers_won_b}
                  done={t.status === "completed"}
                  live={t.status === "pending" && started}
                  fresh={t.status === "completed" && rs.some((r) => recent.has(r.id))}
                />
              );
            })}
          </TvCard>
        </div>
      ),
    });
  }

  // ── Knockout ──
  const koStages = (["r16", "quarterfinal", "semifinal", "final", "third"] as const).filter((st) => ties.some((t) => t.stage === st));
  if (koStages.length > 0) {
    const columns = koStages
      .filter((st) => st !== "third")
      .map((st) => ({ st, ts: ties.filter((t) => t.stage === st || (st === "final" && t.stage === "third")) }));
    screens.push({
      key: "ko",
      label: "Trung kết",
      node: (
        <div className="grid h-full gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((c) => (
            <TvCard key={c.st} title={TIE_STAGE_LABEL[c.st]}>
              {c.ts.map((t) => {
                const rs = rubbersOf(t.id);
                return (
                  <TvMatchRow
                    key={t.id}
                    meta={t.stage === "third" ? "Hạng 3" : undefined}
                    a={squadName(t.squad_a_id)}
                    b={squadName(t.squad_b_id)}
                    scoreA={t.rubbers_won_a}
                    scoreB={t.rubbers_won_b}
                    done={t.status === "completed"}
                    live={t.status === "pending" && rs.some((r) => r.status !== "pending")}
                    fresh={t.status === "completed" && rs.some((r) => recent.has(r.id))}
                    size={columns.length <= 2 ? "lg" : "md"}
                  />
                );
              })}
            </TvCard>
          ))}
        </div>
      ),
    });
  }

  // ── Champion ──
  const finalTie = ties.find((t) => t.stage === "final");
  if (finalTie && finalTie.status === "completed" && finalTie.winner_squad_id) {
    const runnerId = finalTie.winner_squad_id === finalTie.squad_a_id ? finalTie.squad_b_id : finalTie.squad_a_id;
    screens.push({
      key: "podium",
      label: "Kết quả",
      node: (
        <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
          <div>
            <p className="text-2xl font-bold uppercase tracking-[0.3em] text-yellow-400">🏆 Vô địch</p>
            <p className="mt-3 text-[64px] font-black leading-tight">{squadName(finalTie.winner_squad_id)}</p>
            <p className="mt-2 text-2xl text-zinc-400">Chung kết {finalTie.rubbers_won_a} – {finalTie.rubbers_won_b}</p>
          </div>
          <div>
            <p className="text-lg font-bold uppercase tracking-widest text-zinc-400">🥈 Á quân</p>
            <p className="mt-1 text-3xl font-bold">{squadName(runnerId)}</p>
          </div>
        </div>
      ),
    });
  }

  const stageLabel =
    event.stage === "setup" ? "Đang chuẩn bị" : event.stage === "group" ? "Vòng bảng" : event.stage === "knockout" ? "Vòng trung kết" : "Đã kết thúc";

  return (
    <TvShell
      title={event.name}
      subtitle={`Giải đồng đội · ${stageLabel} · ${squads.length} đội`}
      screens={screens}
      conn={conn}
      updatedAt={updatedAt}
      banner={bannerNode}
    />
  );
}
