export interface PairParticipant {
  id: string;
  name: string;
  joinedAt: number;
}

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
 */
export function shuffleParticipants(
  participants: PairParticipant[],
  groupSize: number,
  seed: number,
  round: number,
): PairResult {
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
