import { SingleElimination } from "tournament-pairings";
import type { BracketSection, Match, Team } from "./types";
import { matchKey } from "./types";

export interface SingleElimOptions {
  bracket?: BracketSection;
  groupLabel?: string;
  startingRound?: number;
}

/**
 * Wrap tournament-pairings SingleElimination into our Match shape.
 * Auto-handles byes: when a round 1 match has only one player, it is marked status='bye'.
 */
export function generateSingleElim(
  teams: Team[],
  opts: SingleElimOptions = {},
): Match[] {
  if (teams.length < 2) {
    throw new Error("Need at least 2 teams for single elimination");
  }
  const bracket: BracketSection = opts.bracket ?? "main";
  const groupLabel = opts.groupLabel;
  const startingRound = opts.startingRound ?? 1;

  const ids = teams.map((t) => t.id);
  const raw = SingleElimination(ids, startingRound, false, true);

  // tournament-pairings encodes byes implicitly: top seeds skip round 1 and
  // appear directly in round 2 paired against null (awaiting an upstream winner).
  // We surface that as a "ready" match where one team is set; status stays 'pending'
  // until the opposing slot fills via advanceWinner.
  return raw.map((m): Match => {
    const teamA = m.player1 == null ? null : String(m.player1);
    const teamB = m.player2 == null ? null : String(m.player2);
    return {
      id: matchKey(bracket, m.round, m.match, groupLabel),
      round: m.round,
      matchNumber: m.match,
      bracket,
      groupLabel,
      teamA,
      teamB,
      scoreA: 0,
      scoreB: 0,
      winner: null,
      status: "pending",
      nextWinId: m.win
        ? matchKey(bracket, m.win.round, m.win.match, groupLabel)
        : undefined,
      nextLossId: m.loss
        ? matchKey("losers", m.loss.round, m.loss.match, groupLabel)
        : undefined,
    };
  });
}

/**
 * Count implicit byes for a single-elim of N teams (top seeds skipping round 1).
 */
export function countByes(teamCount: number): number {
  if (teamCount < 2) return 0;
  return Math.pow(2, Math.ceil(Math.log2(teamCount))) - teamCount;
}

/**
 * Advance a winner from a completed match into its nextWinId slot.
 * Pure: returns a new Match[] with mutation applied.
 */
export function advanceWinner(matches: Match[], completedId: string): Match[] {
  const completed = matches.find((m) => m.id === completedId);
  if (!completed || completed.winner === null || !completed.nextWinId) {
    return matches;
  }
  const winnerId = completed.winner;
  return matches.map((m) => {
    if (m.id !== completed.nextWinId) return m;
    if (m.teamA === null) return { ...m, teamA: winnerId };
    if (m.teamB === null) return { ...m, teamB: winnerId };
    return m;
  });
}

/**
 * Sweep all bye matches and advance their pre-determined winners.
 * Repeats until no more bye matches with ready next slots.
 */
export function resolveByes(matches: Match[]): Match[] {
  let result = matches;
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of result) {
      if (m.status === "bye" && m.winner && m.nextWinId) {
        const target = result.find((x) => x.id === m.nextWinId);
        if (!target) continue;
        const slotOpen = target.teamA === null || target.teamB === null;
        if (!slotOpen) continue;
        const isAlreadyPlaced =
          target.teamA === m.winner || target.teamB === m.winner;
        if (isAlreadyPlaced) continue;
        result = advanceWinner(result, m.id);
        changed = true;
      }
    }
  }
  return result;
}
