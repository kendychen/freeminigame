/** Pre-computed balanced PIC (xoay cặp) doubles schedules.
 * Each entry: pair A (indices a[0],a[1]) vs pair B (indices b[0],b[1]).
 */

export interface MatchSlot { a: [number, number]; b: [number, number] }

const SCHEDULES: Record<number, MatchSlot[]> = {
  4: [
    { a: [0, 1], b: [2, 3] },
    { a: [0, 2], b: [1, 3] },
    { a: [0, 3], b: [1, 2] },
  ],
  5: [
    { a: [0, 1], b: [2, 3] },
    { a: [0, 2], b: [3, 4] },
    { a: [0, 3], b: [1, 4] },
    { a: [0, 4], b: [1, 2] },
    { a: [1, 3], b: [2, 4] },
  ],
  6: [
    { a: [0, 1], b: [2, 3] },
    { a: [0, 2], b: [4, 5] },
    { a: [0, 3], b: [1, 5] },
    { a: [1, 4], b: [2, 5] },
    { a: [0, 4], b: [3, 5] },
    { a: [1, 2], b: [3, 4] },
  ],
  7: [
    { a: [0, 1], b: [2, 4] },
    { a: [1, 2], b: [3, 5] },
    { a: [2, 3], b: [4, 6] },
    { a: [3, 4], b: [0, 5] },
    { a: [4, 5], b: [1, 6] },
    { a: [5, 6], b: [0, 2] },
    { a: [0, 6], b: [1, 3] },
  ],
  8: [
    { a: [0, 1], b: [2, 3] },
    { a: [4, 5], b: [6, 7] },
    { a: [0, 4], b: [1, 5] },
    { a: [2, 6], b: [3, 7] },
    { a: [0, 6], b: [1, 7] },
    { a: [2, 4], b: [3, 5] },
    { a: [0, 2], b: [4, 6] },
    { a: [1, 3], b: [5, 7] },
  ],
};

export function generateGroupSchedule(n: number): MatchSlot[] {
  const s = SCHEDULES[n];
  if (!s) throw new Error(`Số VĐV phải là 4, 5, 6, 7 hoặc 8`);
  return s;
}

/**
 * Cross-tier schedule: teamA = (A-tier[aIdx], B-tier[bIdx]), same for teamB.
 * Guarantees each A-player partners exactly once with each B-player (Latin square).
 * n = number of players per tier (2 or 4).
 */
export interface CrossMatchSlot {
  teamA: [aIdx: number, bIdx: number];
  teamB: [aIdx: number, bIdx: number];
}

const CROSS_SCHEDULES: Record<number, CrossMatchSlot[]> = {
  2: [
    { teamA: [0, 0], teamB: [1, 1] },
    { teamA: [0, 1], teamB: [1, 0] },
  ],
  4: [
    { teamA: [0, 0], teamB: [1, 1] },
    { teamA: [2, 2], teamB: [3, 3] },
    { teamA: [0, 1], teamB: [2, 3] },
    { teamA: [1, 2], teamB: [3, 0] },
    { teamA: [0, 2], teamB: [3, 1] },
    { teamA: [1, 3], teamB: [2, 0] },
    { teamA: [0, 3], teamB: [1, 0] },
    { teamA: [2, 1], teamB: [3, 2] },
  ],
};

export function generateCrossSchedule(n: number): CrossMatchSlot[] {
  const s = CROSS_SCHEDULES[n];
  if (!s) throw new Error(`Chế độ A/B chỉ hỗ trợ 2 hoặc 4 VĐV mỗi trình mỗi bảng`);
  return s;
}
