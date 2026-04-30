export interface PairParticipant {
  id: string;
  name: string;
  joinedAt: number;
  /** Optional seed tag (e.g. 'A','B' or 'Nam','Nữ'). Used by balanced draw mode. */
  tag?: string | null;
}

export type DrawMode = "random_all" | "balanced_by_tag";

export interface PairResult {
  round: number;
  shuffledAt: number;
  groups: string[][]; // each subarray = one group of participant ids
  byes: string[];    // ids that didn't fit (when N % groupSize !== 0)
}

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

function shuffleDeterministic<T>(arr: T[], seed: number): T[] {
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
 * Pure deterministic shuffle. Returns groups + leftover byes.
 *
 * mode = 'random_all' (default): plain shuffle, slice into groups of groupSize.
 * mode = 'balanced_by_tag': bucket participants by tag, shuffle each bucket
 *   independently, then round-robin pick one per bucket per group so every
 *   group gets a balanced mix of tags. Leftover after all groups are full goes
 *   to byes. If only one tag exists (or no tags), behaves like random_all.
 */
export function shuffleParticipants(
  participants: PairParticipant[],
  groupSize: number,
  seed: number,
  round: number,
  mode: DrawMode = "random_all",
): PairResult {
  if (mode === "balanced_by_tag") {
    return shuffleBalanced(participants, groupSize, seed, round);
  }
  const ids = participants.map((p) => p.id);
  const shuffled = shuffleDeterministic(ids, seed);
  const groups: string[][] = [];
  const byes: string[] = [];
  let i = 0;
  while (i + groupSize <= shuffled.length) {
    groups.push(shuffled.slice(i, i + groupSize));
    i += groupSize;
  }
  while (i < shuffled.length) {
    byes.push(shuffled[i]!);
    i += 1;
  }
  return {
    round,
    shuffledAt: Date.now(),
    groups,
    byes,
  };
}

function shuffleBalanced(
  participants: PairParticipant[],
  groupSize: number,
  seed: number,
  round: number,
): PairResult {
  const buckets = new Map<string, string[]>();
  for (const p of participants) {
    const key = (p.tag ?? "").trim() || "_";
    const arr = buckets.get(key) ?? [];
    arr.push(p.id);
    buckets.set(key, arr);
  }
  // Single tag bucket → fall back to plain shuffle
  if (buckets.size <= 1) {
    return shuffleParticipants(participants, groupSize, seed, round, "random_all");
  }

  // Shuffle each bucket independently with a tag-derived seed offset
  const tagKeys = Array.from(buckets.keys()).sort();
  const shuffledBuckets = tagKeys.map((k, i) =>
    shuffleDeterministic(buckets.get(k)!, (seed + i * 1009) >>> 0),
  );

  const totalGroups = Math.floor(participants.length / groupSize);
  const groups: string[][] = Array.from({ length: totalGroups }, () => []);
  const byes: string[] = [];

  // Round-robin: for each "row" of a group, pick from a different tag bucket
  // until each group has groupSize members.
  let bucketCursor = 0;
  for (let row = 0; row < groupSize; row++) {
    for (let g = 0; g < totalGroups; g++) {
      // Try buckets in order starting at bucketCursor; pick the first non-empty
      let picked: string | undefined;
      for (let attempt = 0; attempt < shuffledBuckets.length; attempt++) {
        const idx = (bucketCursor + attempt) % shuffledBuckets.length;
        const bucket = shuffledBuckets[idx]!;
        if (bucket.length > 0) {
          picked = bucket.shift();
          bucketCursor = (idx + 1) % shuffledBuckets.length;
          break;
        }
      }
      if (picked) groups[g]!.push(picked);
    }
  }
  // Anything still in buckets after filling all groups → byes
  for (const b of shuffledBuckets) byes.push(...b);

  return {
    round,
    shuffledAt: Date.now(),
    groups,
    byes,
  };
}
