import type { Match, Team } from "../pairing/types";
import type { Standing, TieBreakerConfig } from "./types";
import { applyTiebreakers } from "./tiebreakers";

export interface ComputeOptions {
  teams: Team[];
  matches: Match[];
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
  tiebreakers?: TieBreakerConfig[];
  groupLabel?: string;
  randomSeed?: number;
}

/**
 * Project completed matches into per-team rows, aggregate, sort.
 * Pure: no IO, deterministic.
 */
export function computeStandings(opts: ComputeOptions): Standing[] {
  const W = opts.pointsForWin ?? 3;
  const D = opts.pointsForDraw ?? 1;
  const L = opts.pointsForLoss ?? 0;
  const filtered = opts.groupLabel
    ? opts.matches.filter((m) => m.groupLabel === opts.groupLabel)
    : opts.matches;
  const baseTeams = opts.groupLabel
    ? opts.teams.filter((t) =>
        filtered.some((m) => m.teamA === t.id || m.teamB === t.id),
      )
    : opts.teams;

  const map = new Map<string, Standing>();
  for (const t of baseTeams) {
    map.set(t.id, {
      teamId: t.id,
      rank: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    });
  }

  for (const m of filtered) {
    if (m.status !== "completed" && m.status !== "bye") continue;
    if (m.status === "bye") {
      if (m.winner) {
        const s = map.get(m.winner);
        if (s) {
          s.played += 1;
          s.wins += 1;
          s.points += W;
        }
      }
      continue;
    }
    if (!m.teamA || !m.teamB) continue;
    const a = map.get(m.teamA);
    const b = map.get(m.teamB);
    if (!a || !b) continue;
    a.played += 1;
    b.played += 1;
    a.goalsFor += m.scoreA;
    a.goalsAgainst += m.scoreB;
    b.goalsFor += m.scoreB;
    b.goalsAgainst += m.scoreA;
    if (m.scoreA > m.scoreB) {
      a.wins += 1;
      a.points += W;
      b.losses += 1;
      b.points += L;
    } else if (m.scoreB > m.scoreA) {
      b.wins += 1;
      b.points += W;
      a.losses += 1;
      a.points += L;
    } else {
      a.draws += 1;
      b.draws += 1;
      a.points += D;
      b.points += D;
    }
  }

  const standings = Array.from(map.values()).map((s) => ({
    ...s,
    goalDiff: s.goalsFor - s.goalsAgainst,
  }));

  // Initial sort by points desc
  standings.sort((x, y) => y.points - x.points);

  const sorted = applyTiebreakers(standings, {
    chain: opts.tiebreakers ?? [
      { order: 1, type: "head_to_head" },
      { order: 2, type: "point_differential" },
      { order: 3, type: "random" },
    ],
    matches: filtered,
    randomSeed: opts.randomSeed ?? 0,
  });
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (item) item.rank = i + 1;
  }
  return sorted;
}
