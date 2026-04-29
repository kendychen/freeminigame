import { DoubleElimination } from "tournament-pairings";
import type { BracketSection, Match, Team } from "./types";
import { matchKey } from "./types";

/**
 * tournament-pairings DoubleElimination returns a flat list with Match records that have
 * `loss` pointers to indicate where losers drop. We tag bracket section based on round
 * structure: rounds before the cross-over are 'winners'; after are 'losers'; final is 'grand_final'.
 *
 * Heuristic: any match whose `round` exceeds the winners-bracket size is in losers/grand_final.
 * The library's grand_final is typically a single match at the highest round number.
 */
export function generateDoubleElim(teams: Team[]): Match[] {
  if (teams.length < 2) {
    throw new Error("Need at least 2 teams for double elimination");
  }
  const ids = teams.map((t) => t.id);
  const raw = DoubleElimination(ids, 1, true);

  const winnersRoundCount = Math.ceil(Math.log2(teams.length));
  const maxRound = raw.reduce((max, m) => Math.max(max, m.round), 0);
  const grandFinalRound = maxRound;

  // Identify winners-bracket matches by tracing from the winners final
  const winnersIds = new Set<string>();
  // Round 1..winnersRoundCount are winners-bracket OR group: heuristic.
  // tournament-pairings actually labels via win/loss pointers; we mark winners as those whose
  // win pointer leads forward within the first half of rounds.
  for (const m of raw) {
    if (m.round <= winnersRoundCount) winnersIds.add(`${m.round}:${m.match}`);
  }

  const labelOf = (round: number, matchNum: number): BracketSection => {
    if (round === grandFinalRound) return "grand_final";
    if (winnersIds.has(`${round}:${matchNum}`)) return "winners";
    return "losers";
  };

  return raw.map((m): Match => {
    const section = labelOf(m.round, m.match);
    const teamA = m.player1 == null ? null : String(m.player1);
    const teamB = m.player2 == null ? null : String(m.player2);
    const isBye = m.round === 1 && (teamA === null) !== (teamB === null);
    const onlyTeam = teamA ?? teamB;
    return {
      id: matchKey(section, m.round, m.match),
      round: m.round,
      matchNumber: m.match,
      bracket: section,
      teamA,
      teamB,
      scoreA: 0,
      scoreB: 0,
      winner: isBye ? onlyTeam : null,
      status: isBye ? "bye" : "pending",
      nextWinId: m.win
        ? matchKey(
            m.win.round === grandFinalRound ? "grand_final" : section,
            m.win.round,
            m.win.match,
          )
        : undefined,
      nextLossId: m.loss
        ? matchKey("losers", m.loss.round, m.loss.match)
        : undefined,
    };
  });
}
