import type { Match, Team } from "./types";
import { generateRoundRobin } from "./round-robin";
import { generateSingleElim } from "./single-elim";

export interface GroupKnockoutOptions {
  groupSize: number; // 3 or 4 typical
  qualifyPerGroup: number; // 1 or 2 typical
  doubleRound?: boolean;
}

export interface GroupKnockoutResult {
  groups: Map<string, Match[]>; // label -> matches
  knockout: Match[]; // empty placeholder until groups complete
  groupAssignments: Map<string, Team[]>; // label -> teams (snake-seeded)
}

/**
 * Snake-seed distribute teams into groups: A1,B1,C1,...,C2,B2,A2,A3,B3,...
 */
export function snakeSeedGroups(
  teams: Team[],
  groupSize: number,
): Map<string, Team[]> {
  if (groupSize < 2) throw new Error("groupSize must be >= 2");
  const groupCount = Math.ceil(teams.length / groupSize);
  const labels = Array.from({ length: groupCount }, (_, i) =>
    String.fromCharCode(65 + i),
  );
  const groups = new Map<string, Team[]>();
  for (const lbl of labels) groups.set(lbl, []);
  for (let i = 0; i < teams.length; i++) {
    const row = Math.floor(i / groupCount);
    const inRow = i % groupCount;
    const idx = row % 2 === 0 ? inRow : groupCount - 1 - inRow;
    const label = labels[idx];
    if (label !== undefined) {
      groups.get(label)!.push(teams[i]!);
    }
  }
  return groups;
}

export function generateGroupKnockout(
  teams: Team[],
  opts: GroupKnockoutOptions,
): GroupKnockoutResult {
  const groups = snakeSeedGroups(teams, opts.groupSize);
  const groupMatches = new Map<string, Match[]>();
  for (const [label, groupTeams] of groups.entries()) {
    if (groupTeams.length < 2) {
      groupMatches.set(label, []);
      continue;
    }
    groupMatches.set(
      label,
      generateRoundRobin(groupTeams, {
        doubleRound: opts.doubleRound,
        bracket: "group",
        groupLabel: label,
      }),
    );
  }
  return {
    groups: groupMatches,
    knockout: [],
    groupAssignments: groups,
  };
}

/**
 * Once group stage completes, call this with the per-group ranked teams to produce knockout matches.
 * Snake re-pair: A1 vs B2, B1 vs A2 (so group winners avoid each other early).
 */
export function promoteToKnockout(
  qualifiedByGroup: Map<string, Team[]>,
): Match[] {
  const labels = Array.from(qualifiedByGroup.keys()).sort();
  const seedOrder: Team[] = [];
  let row = 0;
  let stillFilling = true;
  while (stillFilling) {
    stillFilling = false;
    const isReverse = row % 2 === 1;
    const ordered = isReverse ? [...labels].reverse() : labels;
    for (const lbl of ordered) {
      const list = qualifiedByGroup.get(lbl);
      if (list && list[row] !== undefined) {
        seedOrder.push(list[row]!);
        stillFilling = true;
      }
    }
    row++;
  }
  return generateSingleElim(seedOrder, { bracket: "main" });
}
