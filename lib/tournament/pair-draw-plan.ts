/**
 * Pure planner for the "pair" draw mode (bốc thăm ghép đôi).
 *
 * Computes bucket sizes, the optional Nam/Nữ position lock (slotTags) and the
 * pre-filled assignments coming from "ghim cặp" (pinned pairs).
 * With `pinnedPairs: []` the output is identical to the legacy inline logic.
 */

export interface PairDrawPlayer {
  id: string;
  seedTag: string | null;
}

export type PinnedPair = [string, string];

export interface PairDrawAssignment {
  g: number;
  p: number;
  pinned: true;
}

export interface PairDrawPlanInput {
  players: PairDrawPlayer[];
  teamCount: number;
  pinnedPairs: PinnedPair[];
  balancedByTag: boolean;
}

export type PairDrawPlan =
  | {
      ok: true;
      slotSizes: number[];
      slotTags: Record<string, string> | null;
      assignments: Record<string, PairDrawAssignment>;
    }
  | { ok: false; error: string };

const tagOf = (p: PairDrawPlayer) => (p.seedTag ?? "").trim();

export function buildPairDrawPlan(input: PairDrawPlanInput): PairDrawPlan {
  const { players, teamCount, pinnedPairs, balancedByTag } = input;

  if (players.length < 4) return { ok: false, error: "need_at_least_4_players" };

  const maxTeams = Math.floor(players.length / 2);
  if (teamCount < 2 || teamCount > maxTeams)
    return { ok: false, error: "invalid_team_count" };

  const base = Math.floor(players.length / teamCount);
  const extra = players.length % teamCount;
  const slotSizes = Array.from({ length: teamCount }, (_, i) =>
    base + (i < extra ? 1 : 0),
  );

  let slotTags: Record<string, string> | null = null;
  if (balancedByTag) {
    if (players.length !== teamCount * 2)
      return { ok: false, error: "need_even_players" };
    const tags = new Map<string, number>();
    for (const p of players) {
      const tag = tagOf(p);
      if (!tag) return { ok: false, error: "missing_tag" };
      tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }
    const entries = [...tags.entries()];
    if (entries.length !== 2 || entries[0]![1] !== entries[1]![1])
      return { ok: false, error: "tags_unbalanced" };
    // "Nam" (or alphabetical first) always draws position 1
    entries.sort((a, b) =>
      a[0] === "Nam" ? -1 : b[0] === "Nam" ? 1 : a[0].localeCompare(b[0]),
    );
    slotTags = { "1": entries[0]![0], "2": entries[1]![0] };
  }

  const assignments: Record<string, PairDrawAssignment> = {};
  if (!Array.isArray(pinnedPairs)) return { ok: false, error: "pin_invalid" };
  if (pinnedPairs.length === 0)
    return { ok: true, slotSizes, slotTags, assignments };
  if (pinnedPairs.length > teamCount) return { ok: false, error: "pin_too_many" };

  const byId = new Map(players.map((p) => [p.id, p]));
  const seen = new Set<string>();
  for (const pair of pinnedPairs) {
    if (!Array.isArray(pair) || pair.length !== 2)
      return { ok: false, error: "pin_invalid" };
    const [a, b] = pair;
    if (!a || !b || a === b) return { ok: false, error: "pin_invalid" };
    if (!byId.has(a) || !byId.has(b)) return { ok: false, error: "pin_invalid" };
    if (seen.has(a) || seen.has(b)) return { ok: false, error: "pin_duplicate" };
    seen.add(a);
    seen.add(b);
  }
  if (pinnedPairs.length > teamCount) return { ok: false, error: "pin_too_many" };

  for (let i = 0; i < pinnedPairs.length; i++) {
    const [a, b] = pinnedPairs[i]!;
    const g = teamCount - 1 - i;
    let first = a;
    let second = b;
    if (slotTags) {
      const t1 = slotTags["1"]!;
      const t2 = slotTags["2"]!;
      const ta = tagOf(byId.get(a)!);
      const tb = tagOf(byId.get(b)!);
      if (ta === t1 && tb === t2) {
        first = a;
        second = b;
      } else if (tb === t1 && ta === t2) {
        first = b;
        second = a;
      } else {
        return { ok: false, error: "pin_tag_conflict" };
      }
    }
    assignments[first] = { g, p: 1, pinned: true };
    assignments[second] = { g, p: 2, pinned: true };
  }

  return { ok: true, slotSizes, slotTags, assignments };
}
