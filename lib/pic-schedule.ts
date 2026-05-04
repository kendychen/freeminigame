/** Pre-computed balanced PIC (xoay cặp) doubles schedules.
 * Each entry: pair A (indices a[0],a[1]) vs pair B (indices b[0],b[1]).
 *
 * N=4: 3 matches, each player partners with all 3 others once.
 * N=5: 5 matches, each player partners with all 4 others once (sits out 1).
 * N=6: 6 matches, each player plays 4 matches with 4 different partners.
 */

export interface MatchSlot { a: [number, number]; b: [number, number] }

const SCHEDULES: Record<number, MatchSlot[]> = {
  4: [
    { a: [0, 1], b: [2, 3] },
    { a: [0, 2], b: [1, 3] },
    { a: [0, 3], b: [1, 2] },
  ],
  5: [
    { a: [0, 1], b: [2, 3] }, // 4 sits
    { a: [0, 2], b: [3, 4] }, // 1 sits
    { a: [0, 3], b: [1, 4] }, // 2 sits
    { a: [0, 4], b: [1, 2] }, // 3 sits
    { a: [1, 3], b: [2, 4] }, // 0 sits
  ],
  6: [
    { a: [0, 1], b: [2, 3] }, // 4,5 out
    { a: [0, 2], b: [4, 5] }, // 1,3 out
    { a: [0, 3], b: [1, 5] }, // 2,4 out
    { a: [1, 4], b: [2, 5] }, // 0,3 out
    { a: [0, 4], b: [3, 5] }, // 1,2 out
    { a: [1, 2], b: [3, 4] }, // 0,5 out
  ],
};

export function generateGroupSchedule(n: number): MatchSlot[] {
  const s = SCHEDULES[n];
  if (!s) throw new Error(`Số VĐV phải là 4, 5 hoặc 6`);
  return s;
}
