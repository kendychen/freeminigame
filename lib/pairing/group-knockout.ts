import type { Match, Team } from "./types";
import { generateRoundRobin } from "./round-robin";
import { generateSingleElim } from "./single-elim";

export interface GroupKnockoutOptions {
  groupSize: number; // 3 or 4 typical
  qualifyPerGroup: number; // 1 or 2 typical
  doubleRound?: boolean;
  groupCount?: number; // when set, wins over groupSize (chia theo số bảng)
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
  return snakeSeedGroupsByCount(teams, Math.ceil(teams.length / groupSize));
}

/** Snake-seed into exactly `groupCount` groups (sizes differ by at most 1). */
export function snakeSeedGroupsByCount(
  teams: Team[],
  groupCount: number,
): Map<string, Team[]> {
  if (groupCount < 1) throw new Error("groupCount must be >= 1");
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
  const groups = opts.groupCount
    ? snakeSeedGroupsByCount(teams, opts.groupCount)
    : snakeSeedGroups(teams, opts.groupSize);
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
 * Seeds are laid out row by row (A1,B1,C1,…,A2,B2,C2,…) so group winners hold the
 * top seeds and land in opposite halves. Round-1 pairings are then checked and
 * same-group clashes are swapped away, so it is always 1st A vs 2nd B, 1st B vs 2nd A.
 * `bracket` defaults to "main"; pass "plate" for Series B (Cúp phụ).
 */
export function promoteToKnockout(
  qualifiedByGroup: Map<string, Team[]>,
  bracket: "main" | "plate" = "main",
): Match[] {
  const labels = Array.from(qualifiedByGroup.keys()).sort();
  const groupOf = new Map<string, string>();
  const seedOrder: Team[] = [];
  let row = 0;
  let stillFilling = true;
  while (stillFilling) {
    stillFilling = false;
    for (const lbl of labels) {
      const list = qualifiedByGroup.get(lbl);
      if (list && list[row] !== undefined) {
        seedOrder.push(list[row]!);
        groupOf.set(list[row]!.id, lbl);
        stillFilling = true;
      }
    }
    row++;
  }
  if (seedOrder.length < 2) return [];
  const matches = generateSingleElim(seedOrder, { bracket });
  return avoidSameGroupInFirstRound(matches, groupOf);
}

/**
 * Swap the lower-seeded side (teamB) between round-1 matches until no match
 * pairs two teams from the same group. Only teamB slots are exchanged so the
 * top seeds keep their bracket positions. Gives up (leaves the clash) when no
 * swap can fix it, e.g. every qualifier comes from one group.
 */
function avoidSameGroupInFirstRound(
  matches: Match[],
  groupOf: Map<string, string>,
): Match[] {
  const out = matches.map((m) => ({ ...m }));
  const r1 = out.filter((m) => m.round === 1 && m.teamA && m.teamB);
  const clash = (a: string | null, b: string | null) =>
    !!a && !!b && groupOf.get(a) === groupOf.get(b);
  for (let guard = 0; guard < r1.length * 2; guard++) {
    const bad = r1.find((m) => clash(m.teamA, m.teamB));
    if (!bad) break;
    const partner = r1.find(
      (m) =>
        m !== bad &&
        !clash(bad.teamA, m.teamB) &&
        !clash(m.teamA, bad.teamB),
    );
    if (!partner) break;
    [bad.teamB, partner.teamB] = [partner.teamB, bad.teamB];
  }
  return out;
}
