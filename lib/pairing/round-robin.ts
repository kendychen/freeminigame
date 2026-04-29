import { RoundRobin } from "tournament-pairings";
import type { BracketSection, Match, Team } from "./types";
import { matchKey } from "./types";

export interface RoundRobinOptions {
  doubleRound?: boolean;
  bracket?: BracketSection;
  groupLabel?: string;
}

/**
 * Generate a round-robin schedule. If doubleRound, returns N-1 + N-1 rounds with reversed home/away.
 */
export function generateRoundRobin(
  teams: Team[],
  opts: RoundRobinOptions = {},
): Match[] {
  if (teams.length < 2) {
    throw new Error("Need at least 2 teams for round robin");
  }
  const bracket: BracketSection = opts.bracket ?? "main";
  const groupLabel = opts.groupLabel;
  const ids = teams.map((t) => t.id);

  const first = RoundRobin(ids, 1, true);
  const buildSet = (raw: typeof first, roundOffset = 0, swap = false) =>
    raw.map(
      (m): Match => {
        const p1 = m.player1 == null ? null : String(m.player1);
        const p2 = m.player2 == null ? null : String(m.player2);
        const teamA = swap ? p2 : p1;
        const teamB = swap ? p1 : p2;
        const exactlyOneNull = (teamA === null) !== (teamB === null);
        const winnerOnBye = teamA ?? teamB;
        return {
          id: matchKey(bracket, m.round + roundOffset, m.match, groupLabel),
          round: m.round + roundOffset,
          matchNumber: m.match,
          bracket,
          groupLabel,
          teamA,
          teamB,
          scoreA: 0,
          scoreB: 0,
          winner: exactlyOneNull ? winnerOnBye : null,
          status: exactlyOneNull ? "bye" : "pending",
        };
      },
    );

  if (!opts.doubleRound) return buildSet(first);
  const lastRound = first.reduce((max, m) => Math.max(max, m.round), 0);
  return [...buildSet(first), ...buildSet(first, lastRound, true)];
}
