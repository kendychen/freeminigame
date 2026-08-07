/** Team mode group split + round-robin tie generation. Pure, no IO —
 * generateTeamSchedule (server action) persists the returned descriptors. */

import { RoundRobin } from "tournament-pairings";

export interface GroupAssignment {
  label: string;
  squadIds: string[];
}

export interface TieDescriptor {
  stage: "group";
  group_label: string;
  round: number;
  tie_no: number;
  squad_a_id: string;
  squad_b_id: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]!; a[j] = tmp!;
  }
  return a;
}

/**
 * Fisher-Yates shuffle then round-robin deal into groupCount buckets
 * (sizes differ by ≤1). Labels A, B, C… Every group needs ≥2 squads,
 * so 1 ≤ groupCount ≤ ⌊n/2⌋.
 */
export function splitIntoGroups(squadIds: string[], groupCount: number): GroupAssignment[] {
  if (groupCount < 1 || groupCount > Math.floor(squadIds.length / 2)) {
    throw new Error("invalid_group_count");
  }
  const shuffled = shuffle(squadIds);
  const buckets: string[][] = Array.from({ length: groupCount }, () => []);
  shuffled.forEach((id, i) => buckets[i % groupCount]!.push(id));
  return buckets.map((ids, i) => ({
    label: String.fromCharCode(65 + i),
    squadIds: ids,
  }));
}

/**
 * Round-robin ties per group via tournament-pairings (same call as
 * lib/pairing/round-robin.ts). Bye slots (null) are dropped — odd groups rest
 * one squad per round. tie_no runs 1..N ordered by (group_label, round, pair).
 */
export function buildGroupTies(groups: GroupAssignment[]): TieDescriptor[] {
  const ties: TieDescriptor[] = [];
  let tieNo = 1;
  for (const group of groups) {
    const pairings = RoundRobin([...group.squadIds], 1, true) // copy: RoundRobin pushes a null bye into its input when odd
      .filter((m) => m.player1 != null && m.player2 != null)
      .sort((a, b) => a.round - b.round || a.match - b.match);
    for (const m of pairings) {
      ties.push({
        stage: "group",
        group_label: group.label,
        round: m.round,
        tie_no: tieNo++,
        squad_a_id: String(m.player1),
        squad_b_id: String(m.player2),
      });
    }
  }
  return ties;
}

export function buildTeamSchedule(
  squadIds: string[],
  groupCount: number,
): { groups: GroupAssignment[]; ties: TieDescriptor[] } {
  const groups = splitIntoGroups(squadIds, groupCount);
  return { groups, ties: buildGroupTies(groups) };
}
