import type { Match, Team } from "./types";
import { matchKey } from "./types";

/**
 * Deterministic Fisher-Yates shuffle (mulberry32).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * One-shot random pair-up. N people → ceil(N/2) matches.
 * If N is odd, the last person gets a bye.
 */
export function generateRandomPairs(
  teams: Team[],
  randomSeed: number,
): Match[] {
  if (teams.length < 2) {
    throw new Error("Need at least 2 participants");
  }
  const shuffled = shuffle(teams, randomSeed);
  const matches: Match[] = [];
  let matchNumber = 1;
  for (let i = 0; i < shuffled.length; i += 2) {
    const a = shuffled[i]!;
    const b = shuffled[i + 1] ?? null;
    matches.push({
      id: matchKey("main", 1, matchNumber),
      round: 1,
      matchNumber,
      bracket: "main",
      teamA: a.id,
      teamB: b ? b.id : null,
      scoreA: 0,
      scoreB: 0,
      winner: b ? null : a.id,
      status: b ? "pending" : "bye",
    });
    matchNumber += 1;
  }
  return matches;
}

/**
 * Random group split. N people → ceil(N/groupSize) groups.
 * Each group is one "match" with a list of member IDs in groupLabel encoding (semicolon-joined).
 */
export interface RandomGroup {
  label: string;
  memberIds: string[];
}

export function generateRandomGroups(
  teams: Team[],
  groupSize: number,
  randomSeed: number,
): RandomGroup[] {
  if (groupSize < 2) throw new Error("groupSize must be >= 2");
  if (teams.length < groupSize) throw new Error("Not enough teams");
  const shuffled = shuffle(teams, randomSeed);
  const groupCount = Math.ceil(shuffled.length / groupSize);
  const groups: RandomGroup[] = [];
  for (let i = 0; i < groupCount; i++) {
    groups.push({ label: String.fromCharCode(65 + i), memberIds: [] });
  }
  // Distribute round-robin style so groups are balanced when N % groupSize !== 0
  for (let i = 0; i < shuffled.length; i++) {
    const target = i % groupCount;
    groups[target]!.memberIds.push(shuffled[i]!.id);
  }
  return groups;
}
