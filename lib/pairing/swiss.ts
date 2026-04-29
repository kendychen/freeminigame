import { Swiss } from "tournament-pairings";

interface SwissPlayer {
  id: string | number;
  score: number;
  pairedUpDown?: boolean;
  receivedBye?: boolean;
  avoid?: Array<string | number>;
  seating?: Array<-1 | 1>;
  rating?: number | null;
}
import type { AvoidConfig, Match, Team } from "./types";
import { matchKey } from "./types";

export interface SwissHistory {
  teamId: string;
  score: number;
  opponentIds: string[];
  receivedBye: boolean;
  region?: string;
}

export interface GenerateSwissRoundOptions {
  avoid?: AvoidConfig;
  rated?: boolean;
}

/**
 * Build per-team history from completed matches (for next-round Swiss pairing).
 * Win = 1, draw = 0.5, loss = 0. Bye counted as 1.
 */
export function buildSwissHistory(
  teams: Team[],
  matches: Match[],
): Map<string, SwissHistory> {
  const out = new Map<string, SwissHistory>();
  for (const t of teams) {
    out.set(t.id, {
      teamId: t.id,
      score: 0,
      opponentIds: [],
      receivedBye: false,
      region: t.region,
    });
  }
  for (const m of matches) {
    if (m.status !== "completed" && m.status !== "bye") continue;
    if (m.status === "bye") {
      const w = m.winner;
      if (w) {
        const h = out.get(w);
        if (h) {
          h.score += 1;
          h.receivedBye = true;
        }
      }
      continue;
    }
    if (m.teamA && m.teamB) {
      const a = out.get(m.teamA);
      const b = out.get(m.teamB);
      if (a) a.opponentIds.push(m.teamB);
      if (b) b.opponentIds.push(m.teamA);
      if (m.scoreA > m.scoreB) {
        if (a) a.score += 1;
      } else if (m.scoreB > m.scoreA) {
        if (b) b.score += 1;
      } else {
        if (a) a.score += 0.5;
        if (b) b.score += 0.5;
      }
    }
  }
  return out;
}

export function generateSwissRound(
  teams: Team[],
  history: Map<string, SwissHistory>,
  roundNumber: number,
  opts: GenerateSwissRoundOptions = {},
): Match[] {
  if (teams.length < 2) {
    throw new Error("Need at least 2 teams for Swiss");
  }
  const avoid = opts.avoid ?? {};
  const players: SwissPlayer[] = teams.map((t) => {
    const h = history.get(t.id);
    const baseAvoid = h ? [...h.opponentIds] : [];
    if (avoid.byRegion && t.region) {
      for (const other of teams) {
        if (other.id !== t.id && other.region === t.region) {
          baseAvoid.push(other.id);
        }
      }
    }
    if (avoid.manualPairs) {
      for (const [a, b] of avoid.manualPairs) {
        if (a === t.id) baseAvoid.push(b);
        if (b === t.id) baseAvoid.push(a);
      }
    }
    return {
      id: t.id,
      score: h?.score ?? 0,
      receivedBye: h?.receivedBye ?? false,
      avoid: Array.from(new Set(baseAvoid)),
      rating: t.rating,
    };
  });

  const raw = Swiss(players, roundNumber, opts.rated ?? false, false);

  return raw.map((m): Match => {
    const teamA = m.player1 == null ? null : String(m.player1);
    const teamB = m.player2 == null ? null : String(m.player2);
    const isBye = (teamA === null) !== (teamB === null);
    const onlyTeam = teamA ?? teamB;
    return {
      id: matchKey("main", m.round, m.match),
      round: m.round,
      matchNumber: m.match,
      bracket: "main",
      teamA,
      teamB,
      scoreA: 0,
      scoreB: 0,
      winner: isBye ? onlyTeam : null,
      status: isBye ? "bye" : "pending",
    };
  });
}
