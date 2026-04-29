import type { Match } from "../pairing/types";
import type { Standing, TieBreakerConfig, TieBreakerType } from "./types";

export interface ApplyTiebreakersInput {
  chain: TieBreakerConfig[];
  matches: Match[];
  randomSeed?: number;
}

/**
 * Mulberry32 deterministic PRNG.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Group standings by points (the primary key) into ties; resolve each tie via the chain.
 */
export function applyTiebreakers(
  standings: Standing[],
  input: ApplyTiebreakersInput,
): Standing[] {
  const groups: Standing[][] = [];
  let cur: Standing[] = [];
  let curPts: number | null = null;
  for (const s of standings) {
    if (curPts === null || s.points === curPts) {
      cur.push(s);
      curPts = s.points;
    } else {
      groups.push(cur);
      cur = [s];
      curPts = s.points;
    }
  }
  if (cur.length) groups.push(cur);

  const sortedChain = [...input.chain].sort((a, b) => a.order - b.order);
  const out: Standing[] = [];
  for (const group of groups) {
    if (group.length <= 1) {
      out.push(...group);
      continue;
    }
    const resolved = resolveTie(
      group,
      sortedChain,
      input.matches,
      input.randomSeed ?? 0,
    );
    out.push(...resolved);
  }
  return out;
}

function resolveTie(
  group: Standing[],
  chain: TieBreakerConfig[],
  matches: Match[],
  randomSeed: number,
): Standing[] {
  let current: Standing[] = [...group];
  for (const tb of chain) {
    if (current.length <= 1) break;
    const sorted = sortByTiebreaker(current, tb.type, matches, randomSeed);
    // Detect if this tiebreaker actually separated anyone
    const stillTied = isAllEqual(sorted, tb.type, matches);
    current = sorted;
    if (!stillTied) {
      // Re-group on this tiebreaker's value and recurse for sub-ties
      const subGroups = subGroupBy(current, tb.type, matches);
      const remaining = chain.slice(chain.indexOf(tb) + 1);
      current = subGroups.flatMap((sg) =>
        sg.length > 1
          ? resolveTie(sg, remaining, matches, randomSeed)
          : sg,
      );
      break;
    }
  }
  return current;
}

function sortByTiebreaker(
  group: Standing[],
  type: TieBreakerType,
  matches: Match[],
  randomSeed: number,
): Standing[] {
  const arr = [...group];
  switch (type) {
    case "head_to_head": {
      const ids = new Set(arr.map((s) => s.teamId));
      const h2h = new Map<string, number>();
      for (const s of arr) h2h.set(s.teamId, 0);
      for (const m of matches) {
        if (m.status !== "completed") continue;
        if (!m.teamA || !m.teamB) continue;
        if (!ids.has(m.teamA) || !ids.has(m.teamB)) continue;
        if (m.scoreA > m.scoreB) {
          h2h.set(m.teamA, (h2h.get(m.teamA) ?? 0) + 3);
        } else if (m.scoreB > m.scoreA) {
          h2h.set(m.teamB, (h2h.get(m.teamB) ?? 0) + 3);
        } else {
          h2h.set(m.teamA, (h2h.get(m.teamA) ?? 0) + 1);
          h2h.set(m.teamB, (h2h.get(m.teamB) ?? 0) + 1);
        }
      }
      arr.sort((x, y) => (h2h.get(y.teamId) ?? 0) - (h2h.get(x.teamId) ?? 0));
      return arr;
    }
    case "point_differential":
      arr.sort((x, y) => y.goalDiff - x.goalDiff || y.goalsFor - x.goalsFor);
      return arr;
    case "buchholz": {
      computeBuchholz(arr, matches);
      arr.sort(
        (x, y) => (y.buchholz ?? 0) - (x.buchholz ?? 0) || y.points - x.points,
      );
      return arr;
    }
    case "sonneborn_berger": {
      computeSonnebornBerger(arr, matches);
      arr.sort(
        (x, y) =>
          (y.sonnebornBerger ?? 0) - (x.sonnebornBerger ?? 0) ||
          y.points - x.points,
      );
      return arr;
    }
    case "auxiliary_points":
      arr.sort((x, y) => (y.auxPoints ?? 0) - (x.auxPoints ?? 0));
      return arr;
    case "random": {
      const rng = mulberry32(randomSeed + arr.length);
      const annotated = arr.map((s) => ({ s, k: rng() }));
      annotated.sort((x, y) => x.k - y.k);
      return annotated.map((x) => x.s);
    }
  }
}

function isAllEqual(
  group: Standing[],
  type: TieBreakerType,
  matches: Match[],
): boolean {
  if (group.length <= 1) return false;
  switch (type) {
    case "head_to_head": {
      const ids = new Set(group.map((s) => s.teamId));
      const h2h = new Map<string, number>();
      for (const s of group) h2h.set(s.teamId, 0);
      for (const m of matches) {
        if (m.status !== "completed") continue;
        if (!m.teamA || !m.teamB) continue;
        if (!ids.has(m.teamA) || !ids.has(m.teamB)) continue;
        if (m.scoreA > m.scoreB)
          h2h.set(m.teamA, (h2h.get(m.teamA) ?? 0) + 3);
        else if (m.scoreB > m.scoreA)
          h2h.set(m.teamB, (h2h.get(m.teamB) ?? 0) + 3);
        else {
          h2h.set(m.teamA, (h2h.get(m.teamA) ?? 0) + 1);
          h2h.set(m.teamB, (h2h.get(m.teamB) ?? 0) + 1);
        }
      }
      const vals = Array.from(h2h.values());
      return vals.every((v) => v === vals[0]);
    }
    case "point_differential":
      return group.every((s) => s.goalDiff === group[0]!.goalDiff);
    case "buchholz":
      return group.every((s) => (s.buchholz ?? 0) === (group[0]!.buchholz ?? 0));
    case "sonneborn_berger":
      return group.every(
        (s) =>
          (s.sonnebornBerger ?? 0) === (group[0]!.sonnebornBerger ?? 0),
      );
    case "auxiliary_points":
      return group.every(
        (s) => (s.auxPoints ?? 0) === (group[0]!.auxPoints ?? 0),
      );
    case "random":
      return false;
  }
}

function subGroupBy(
  group: Standing[],
  type: TieBreakerType,
  matches: Match[],
): Standing[][] {
  const keyOf = (s: Standing): string | number => {
    switch (type) {
      case "point_differential":
        return s.goalDiff;
      case "buchholz":
        return s.buchholz ?? 0;
      case "sonneborn_berger":
        return s.sonnebornBerger ?? 0;
      case "auxiliary_points":
        return s.auxPoints ?? 0;
      case "head_to_head": {
        const ids = new Set(group.map((x) => x.teamId));
        let h2h = 0;
        for (const m of matches) {
          if (m.status !== "completed") continue;
          if (!m.teamA || !m.teamB) continue;
          if (!ids.has(m.teamA) || !ids.has(m.teamB)) continue;
          if (m.teamA === s.teamId)
            h2h += m.scoreA > m.scoreB ? 3 : m.scoreA === m.scoreB ? 1 : 0;
          else if (m.teamB === s.teamId)
            h2h += m.scoreB > m.scoreA ? 3 : m.scoreA === m.scoreB ? 1 : 0;
        }
        return h2h;
      }
      case "random":
        return s.teamId;
    }
  };
  const buckets = new Map<string | number, Standing[]>();
  for (const s of group) {
    const k = keyOf(s);
    const arr = buckets.get(k);
    if (arr) arr.push(s);
    else buckets.set(k, [s]);
  }
  // Preserve incoming order (already sorted by tiebreaker)
  const seenKeys: Array<string | number> = [];
  for (const s of group) {
    const k = keyOf(s);
    if (!seenKeys.includes(k)) seenKeys.push(k);
  }
  return seenKeys.map((k) => buckets.get(k)!);
}

function computeBuchholz(group: Standing[], matches: Match[]): void {
  // For each team in group, sum the final scores (points/9 = wins) of all opponents.
  const allTeamScores = new Map<string, number>();
  for (const m of matches) {
    if (m.status !== "completed" && m.status !== "bye") continue;
    if (m.status === "bye" && m.winner) {
      allTeamScores.set(m.winner, (allTeamScores.get(m.winner) ?? 0) + 1);
      continue;
    }
    if (!m.teamA || !m.teamB) continue;
    if (m.scoreA > m.scoreB) {
      allTeamScores.set(m.teamA, (allTeamScores.get(m.teamA) ?? 0) + 1);
    } else if (m.scoreB > m.scoreA) {
      allTeamScores.set(m.teamB, (allTeamScores.get(m.teamB) ?? 0) + 1);
    } else {
      allTeamScores.set(m.teamA, (allTeamScores.get(m.teamA) ?? 0) + 0.5);
      allTeamScores.set(m.teamB, (allTeamScores.get(m.teamB) ?? 0) + 0.5);
    }
  }
  for (const s of group) {
    const opponents = new Set<string>();
    for (const m of matches) {
      if (m.status !== "completed") continue;
      if (m.teamA === s.teamId && m.teamB) opponents.add(m.teamB);
      if (m.teamB === s.teamId && m.teamA) opponents.add(m.teamA);
    }
    let sum = 0;
    for (const oid of opponents) sum += allTeamScores.get(oid) ?? 0;
    s.buchholz = sum;
  }
}

function computeSonnebornBerger(group: Standing[], matches: Match[]): void {
  const allTeamScores = new Map<string, number>();
  for (const m of matches) {
    if (m.status !== "completed" && m.status !== "bye") continue;
    if (m.status === "bye" && m.winner) {
      allTeamScores.set(m.winner, (allTeamScores.get(m.winner) ?? 0) + 1);
      continue;
    }
    if (!m.teamA || !m.teamB) continue;
    if (m.scoreA > m.scoreB) {
      allTeamScores.set(m.teamA, (allTeamScores.get(m.teamA) ?? 0) + 1);
    } else if (m.scoreB > m.scoreA) {
      allTeamScores.set(m.teamB, (allTeamScores.get(m.teamB) ?? 0) + 1);
    } else {
      allTeamScores.set(m.teamA, (allTeamScores.get(m.teamA) ?? 0) + 0.5);
      allTeamScores.set(m.teamB, (allTeamScores.get(m.teamB) ?? 0) + 0.5);
    }
  }
  for (const s of group) {
    let total = 0;
    for (const m of matches) {
      if (m.status !== "completed") continue;
      if (!m.teamA || !m.teamB) continue;
      const isA = m.teamA === s.teamId;
      const isB = m.teamB === s.teamId;
      if (!isA && !isB) continue;
      const opponentId = isA ? m.teamB : m.teamA;
      const oppScore = allTeamScores.get(opponentId) ?? 0;
      let result = 0;
      if (m.scoreA === m.scoreB) result = 0.5;
      else if (isA && m.scoreA > m.scoreB) result = 1;
      else if (isB && m.scoreB > m.scoreA) result = 1;
      total += oppScore * result;
    }
    s.sonnebornBerger = total;
  }
}
