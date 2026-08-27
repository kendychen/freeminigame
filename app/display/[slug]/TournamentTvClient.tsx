"use client";

import { useMemo } from "react";
import { BracketView } from "@/components/bracket/BracketView";
import { computeStandings } from "@/lib/standings";
import type { TieBreakerConfig } from "@/lib/standings/types";
import type { Match, Team } from "@/lib/pairing/types";
import type { DbMatch, DbTeam, DbTournament } from "@/types/database";
import { TvShell, TvCard, TvLiveCard, TvMatchRow, TvStandings, type TvScreen } from "@/components/tv/TvShell";
import { useTvFeed, useRecentlyCompleted } from "@/components/tv/useTvFeed";

const FORMAT_LABEL: Record<string, string> = {
  single_elim: "Loại trực tiếp",
  double_elim: "Nhánh thắng / thua",
  round_robin: "Vòng tròn",
  group_knockout: "Vòng bảng + trung kết",
  swiss: "Hệ Thụy Sĩ",
};

function roundLabel(m: Match, all: Match[]): string {
  if (m.bracket === "grand_final") return "Chung kết tổng";
  if (m.bracket === "group") return m.groupLabel ? `Bảng ${m.groupLabel}` : "Vòng bảng";
  if (m.bracket === "plate") return `Plate · V${m.round}`;
  if (m.bracket === "losers") return `Nhánh thua · V${m.round}`;
  const same = all.filter((x) => x.bracket === m.bracket);
  const maxRound = Math.max(...same.map((x) => x.round));
  const inRound = same.filter((x) => x.round === m.round && x.status !== "bye").length;
  if (inRound === 1 && m.round === maxRound) return "Chung kết";
  if (inRound === 2 && m.round === maxRound - 1) return "Bán kết";
  if (inRound === 4 && m.round === maxRound - 2) return "Tứ kết";
  return `Vòng ${m.round}`;
}

export default function TournamentTvClient({
  tournament,
  teams,
  initialMatches,
}: {
  tournament: DbTournament;
  teams: DbTeam[];
  initialMatches: DbMatch[];
}) {
  const { data: matches, conn, updatedAt } = useTvFeed<DbMatch[]>({
    key: `t:${tournament.id}`,
    initial: initialMatches,
    tables: [{ table: "matches", filter: `tournament_id=eq.${tournament.id}` }],
    refetch: async () => {
      const res = await fetch(`/api/matches/${tournament.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`matches ${res.status}`);
      return (await res.json()) as DbMatch[];
    },
  });

  const teamsTyped: Team[] = useMemo(
    () => teams.map((t) => ({ id: t.id, name: t.name, seed: t.seed ?? undefined, logoUrl: t.logo_url ?? undefined })),
    [teams],
  );
  const teamGroup = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams) if (t.group_label) m.set(t.id, t.group_label);
    return m;
  }, [teams]);
  const matchesTyped: Match[] = useMemo(
    () =>
      matches.map((m) => ({
        id: m.id,
        round: m.round,
        matchNumber: m.match_number,
        bracket: m.bracket,
        groupLabel:
          m.group_label ??
          ((m.team_a_id && m.team_b_id && teamGroup.get(m.team_a_id) === teamGroup.get(m.team_b_id) && teamGroup.get(m.team_a_id)) ||
            undefined),
        teamA: m.team_a_id,
        teamB: m.team_b_id,
        scoreA: m.score_a,
        scoreB: m.score_b,
        winner: m.winner_team_id,
        status: m.status,
        nextWinId: m.next_win_match_id ?? undefined,
        nextLossId: m.next_loss_match_id ?? undefined,
      })),
    [matches, teamGroup],
  );
  const name = (id: string | null) => (id ? teamsTyped.find((t) => t.id === id)?.name ?? "?" : "Chờ xác định");

  const completedIds = useMemo(() => matchesTyped.filter((m) => m.status === "completed").map((m) => m.id), [matchesTyped]);
  const { recent, banner } = useRecentlyCompleted(completedIds);
  const bannerNode = useMemo(() => {
    if (!banner) return null;
    const m = matchesTyped.find((x) => x.id === banner);
    if (!m) return null;
    return `Kết thúc ${roundLabel(m, matchesTyped)}: ${name(m.teamA)} ${m.scoreA} – ${m.scoreB} ${name(m.teamB)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner, matchesTyped, teamsTyped]);

  const cfg = (tournament.config ?? {}) as { tiebreakers?: TieBreakerConfig[]; randomSeed?: number };
  const screens: TvScreen[] = [];

  // ── Live ──
  const liveMatches = matchesTyped.filter((m) => m.status === "live");
  if (liveMatches.length > 0) {
    const shown = liveMatches.slice(0, 4);
    screens.push({
      key: "live",
      label: "Đang đấu",
      node: (
        <div className={`grid h-full gap-5 ${shown.length === 1 ? "grid-cols-1" : "grid-cols-2"} ${shown.length > 2 ? "grid-rows-2" : ""}`}>
          {shown.map((m) => (
            <TvLiveCard key={m.id} label={roundLabel(m, matchesTyped)} a={name(m.teamA)} b={name(m.teamB)} scoreA={m.scoreA} scoreB={m.scoreB} note="Trọng tài đang chấm" />
          ))}
        </div>
      ),
    });
  }

  // ── Standings (group / round robin / swiss) ──
  const groupMatches = matchesTyped.filter((m) => m.bracket === "group");
  const hasBracket = matchesTyped.some((m) => m.bracket !== "group");
  if (groupMatches.length > 0) {
    const labels = Array.from(new Set(groupMatches.map((m) => m.groupLabel).filter((g): g is string => !!g))).sort();
    const keys: (string | undefined)[] = labels.length ? labels : [undefined];
    for (const g of keys) {
      const gTeams = g ? teamsTyped.filter((t) => teamGroup.get(t.id) === g) : teamsTyped;
      const gMatches = g ? groupMatches.filter((m) => m.groupLabel === g) : groupMatches;
      const standings = computeStandings({
        teams: gTeams,
        matches: gMatches,
        groupLabel: g,
        tiebreakers: cfg.tiebreakers,
        randomSeed: cfg.randomSeed ?? 0,
      });
      const done = gMatches.filter((m) => m.status === "completed");
      const pending = gMatches.filter((m) => m.status !== "completed" && m.status !== "bye");
      const rows = [...done.slice(-8), ...pending.slice(0, Math.max(0, 12 - Math.min(done.length, 8)))];
      screens.push({
        key: `group:${g ?? "all"}`,
        label: g ? `Bảng ${g}` : "Xếp hạng",
        node: (
          <div className="grid h-full grid-cols-[1.15fr_1fr] gap-5">
            <TvCard title={g ? `Bảng ${g} · Xếp hạng` : "Bảng xếp hạng"}>
              <TvStandings
                head={["#", "Đội", "Trận", "Thắng", "Thua", "Hiệu số", "Điểm"]}
                rows={standings.map((s) => ({
                  id: s.teamId,
                  cells: [s.rank, name(s.teamId), s.played, s.wins, s.losses, s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff, s.points],
                }))}
              />
            </TvCard>
            <TvCard title={`Kết quả · ${done.length}/${gMatches.length} trận`}>
              {rows.map((m) => (
                <TvMatchRow
                  key={m.id}
                  meta={`Vòng ${m.round}`}
                  a={name(m.teamA)}
                  b={name(m.teamB)}
                  scoreA={m.scoreA}
                  scoreB={m.scoreB}
                  done={m.status === "completed"}
                  live={m.status === "live"}
                  fresh={recent.has(m.id)}
                />
              ))}
            </TvCard>
          </div>
        ),
      });
    }
  }

  // ── Bracket ──
  if (hasBracket) {
    const variant = tournament.format === "double_elim" ? "double" : "single";
    screens.push({
      key: "bracket",
      label: "Nhánh đấu",
      node: (
        <div className="flex h-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <BracketView matches={matchesTyped} teams={teamsTyped} variant={variant} width={1180} height={560} />
        </div>
      ),
    });
    const plate = matchesTyped.filter((m) => m.bracket === "plate");
    if (plate.length > 0) {
      screens.push({
        key: "plate",
        label: "Plate",
        node: (
          <div className="flex h-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <BracketView matches={plate} teams={teamsTyped} variant="single" width={1180} height={560} />
          </div>
        ),
      });
    }
  }

  // ── Recent results ──
  const recentDone = matches
    .filter((m) => m.status === "completed" && m.team_a_id && m.team_b_id)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 10);
  if (recentDone.length > 0) {
    screens.push({
      key: "results",
      label: "Kết quả mới",
      node: (
        <TvCard title="Kết quả mới nhất">
          {recentDone.map((m) => {
            const t = matchesTyped.find((x) => x.id === m.id)!;
            return (
              <TvMatchRow
                key={m.id}
                meta={roundLabel(t, matchesTyped)}
                a={name(m.team_a_id)}
                b={name(m.team_b_id)}
                scoreA={m.score_a}
                scoreB={m.score_b}
                done
                fresh={recent.has(m.id)}
              />
            );
          })}
        </TvCard>
      ),
    });
  }

  // ── Champion ──
  const finalMatch = matchesTyped.find(
    (m) => m.status === "completed" && m.winner && (m.bracket === "grand_final" || roundLabel(m, matchesTyped) === "Chung kết"),
  );
  if (finalMatch && tournament.status === "completed") {
    const runner = finalMatch.winner === finalMatch.teamA ? finalMatch.teamB : finalMatch.teamA;
    screens.push({
      key: "podium",
      label: "Kết quả",
      node: (
        <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
          <div>
            <p className="text-2xl font-bold uppercase tracking-[0.3em] text-yellow-400">🏆 Vô địch</p>
            <p className="mt-3 text-[64px] font-black leading-tight">{name(finalMatch.winner)}</p>
            <p className="mt-2 text-2xl text-zinc-400">Chung kết {finalMatch.scoreA} – {finalMatch.scoreB}</p>
          </div>
          <div>
            <p className="text-lg font-bold uppercase tracking-widest text-zinc-400">🥈 Á quân</p>
            <p className="mt-1 text-3xl font-bold">{name(runner)}</p>
          </div>
        </div>
      ),
    });
  }

  return (
    <TvShell
      title={tournament.name}
      subtitle={`${FORMAT_LABEL[String(tournament.format)] ?? String(tournament.format)} · ${teams.length} đội`}
      screens={screens}
      conn={conn}
      updatedAt={updatedAt}
      banner={bannerNode}
    />
  );
}
