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
    { a: [0, 1], b: [2, 3] },
    { a: [0, 2], b: [4, 5] },
    { a: [0, 3], b: [5, 6] },
    { a: [0, 4], b: [1, 6] },
    { a: [0, 5], b: [3, 4] },
    { a: [0, 6], b: [2, 4] },
    { a: [1, 2], b: [4, 6] },
    { a: [1, 3], b: [2, 5] },
    { a: [1, 4], b: [3, 6] },
  ],
  8: [
    { a: [0, 1], b: [2, 3] },
    { a: [4, 5], b: [6, 7] },
    { a: [0, 2], b: [4, 6] },
    { a: [1, 3], b: [5, 7] },
    { a: [0, 3], b: [5, 6] },
    { a: [1, 2], b: [4, 7] },
    { a: [0, 4], b: [3, 7] },
    { a: [1, 5], b: [2, 6] },
    { a: [0, 5], b: [2, 7] },
    { a: [1, 4], b: [3, 6] },
  ],
};

export function generateGroupSchedule(n: number): MatchSlot[] {
  const s = SCHEDULES[n];
  if (!s) throw new Error(`Số VĐV phải là 4, 5, 6, 7 hoặc 8`);
  return s;
}
