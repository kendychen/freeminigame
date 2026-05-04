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
    const sA = shuffle(advancingByGroup[0]!);
    const sB = shuffle(advancingByGroup[1]!);
    // Each team = 1 from A + 1 from B
    return sA.map((a, i) => [a, sB[i]!] as [string, string]);
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

export const DRAW_MODES: { value: DrawMode; label: string; desc: string }[] = [
  {
    value: "random_all",
    label: "Random toàn bộ",
    desc: "Xáo trộn ngẫu nhiên tất cả người chơi",
  },
  {
    value: "cross_group",
    label: "Chéo bảng A×B",
    desc: "Mỗi cặp đôi gồm 1 người bảng A + 1 người bảng B",
  },
  {
    value: "cross_rank",
    label: "Chéo hạng",
    desc: "A1+B4 đấu A2+B3 · B1+A4 đấu B2+A3",
  },
];
