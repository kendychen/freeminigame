export type DrawMode = "random_all" | "cross_group" | "cross_rank";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]!; a[j] = tmp!;
  }
  return a;
}

/**
 * Returns 4 pairs (teams of 2) ready for picDrawKnockout.
 * pairs[0] vs pairs[1] = semi 1, pairs[2] vs pairs[3] = semi 2.
 *
 * advancingByGroup[i] = player IDs from group i, sorted rank 1→N.
 */
export function buildDrawPairs(
  mode: DrawMode,
  advancingByGroup: string[][],
): [string, string][] {
  const allIds = advancingByGroup.flat();

  if (mode === "cross_group" && advancingByGroup.length >= 2) {
    // Round-robin cross-group: each pair = 2 players from DIFFERENT groups.
    // Pick from group with most remaining, partner = random other non-empty group.
    const buckets = advancingByGroup.map((g) => shuffle([...g]));
    const pairs: [string, string][] = [];

    while (true) {
      const indices = buckets
        .map((_, i) => i)
        .filter((i) => buckets[i]!.length > 0)
        .sort((a, b) => {
          const diff = buckets[b]!.length - buckets[a]!.length;
          return diff !== 0 ? diff : Math.random() - 0.5;
        });

      if (indices.length === 0) break;
      if (indices.length === 1) {
        // Only 1 group has players left → forced same-group pairs (fallback)
        const last = buckets[indices[0]!]!;
        while (last.length >= 2) pairs.push([last.pop()!, last.pop()!]);
        break;
      }

      const i1 = indices[0]!;
      const others = indices.slice(1);
      const i2 = others[Math.floor(Math.random() * others.length)]!;
      pairs.push([buckets[i1]!.pop()!, buckets[i2]!.pop()!]);
    }

    return pairs;
  }

  if (mode === "cross_rank" && advancingByGroup.length >= 2) {
    const A = advancingByGroup[0]!;
    const B = advancingByGroup[1]!;
    const n = A.length; // typically 4
    // Semi 1: (A1+B4) vs (A2+B3)
    // Semi 2: (B1+A4) vs (B2+A3)
    return [
      [A[0]!, B[n - 1]!],
      [A[1]!, B[n - 2]!],
      [B[0]!, A[n - 1]!],
      [B[1]!, A[n - 2]!],
    ];
  }

  // random_all (default)
  const s = shuffle(allIds);
  const pairs: [string, string][] = [];
  for (let i = 0; i < s.length - 1; i += 2) pairs.push([s[i]!, s[i + 1]!]);
  return pairs;
}

/**
 * Re-draw only unlocked pairs. Locked pairs keep their players.
 */
export function reDrawUnlocked(
  currentPairs: [string, string][],
  lockedIndices: Set<number>,
  allIds: string[],
): [string, string][] {
  const lockedIds = new Set<string>();
  for (const i of lockedIndices) {
    const pair = currentPairs[i];
    if (pair) { lockedIds.add(pair[0]); lockedIds.add(pair[1]); }
  }
  const pool = shuffle(allIds.filter((id) => !lockedIds.has(id)));
  const result = [...currentPairs] as [string, string][];
  let poolIdx = 0;
  for (let i = 0; i < result.length; i++) {
    if (!lockedIndices.has(i)) {
      result[i] = [pool[poolIdx]!, pool[poolIdx + 1]!];
      poolIdx += 2;
    }
  }
  return result;
}

export const DRAW_MODES: { value: DrawMode; label: string; desc: string }[] = [
  {
    value: "random_all",
    label: "Random toàn bộ",
    desc: "Xáo trộn ngẫu nhiên tất cả người chơi",
  },
  {
    value: "cross_group",
    label: "Chéo bảng",
    desc: "Mỗi cặp đôi gồm 2 người từ 2 bảng khác nhau (cân bằng nhiều bảng)",
  },
  {
    value: "cross_rank",
    label: "Chéo hạng",
    desc: "A1+B4 đấu A2+B3 · B1+A4 đấu B2+A3",
  },
];
