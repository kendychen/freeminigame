import { describe, it, expect } from "vitest";
import { generateFullPairCross } from "@/lib/pic-schedule";

function verify(M: number, F: number) {
  const s = generateFullPairCross(M, F);
  expect(s, `${M}+${F}`).not.toBeNull();
  if (!s) return;

  // số trận = M×F / 2
  expect(s.length).toBe((M * F) / 2);

  const partnered = new Set<string>();
  const aGames = new Array(M).fill(0) as number[];
  const bGames = new Array(F).fill(0) as number[];

  for (const m of s) {
    for (const t of [m.teamA, m.teamB]) {
      expect(t[0]).toBeGreaterThanOrEqual(0);
      expect(t[0]).toBeLessThan(M);
      expect(t[1]).toBeGreaterThanOrEqual(0);
      expect(t[1]).toBeLessThan(F);
      const k = `${t[0]}-${t[1]}`;
      expect(partnered.has(k), `cặp ${k} lặp lại`).toBe(false);
      partnered.add(k);
      aGames[t[0]]!++;
      bGames[t[1]]!++;
    }
    // 2 đội trong 1 trận không trùng người
    expect(m.teamA[0]).not.toBe(m.teamB[0]);
    expect(m.teamA[1]).not.toBe(m.teamB[1]);
  }

  // đủ MỌI tổ hợp A×B đúng 1 lần
  expect(partnered.size).toBe(M * F);
  // A đánh F trận, B đánh M trận
  for (const g of aGames) expect(g).toBe(F);
  for (const g of bGames) expect(g).toBe(M);

  // Cân bằng chạm mặt: tổng tương tác (đồng đội + đối đầu) của MỌI cặp VĐV ≤ 3
  const inter = new Map<string, number>();
  const bump = (k: string) => inter.set(k, (inter.get(k) ?? 0) + 1);
  for (const m of s) {
    bump(`a${m.teamA[0]}-b${m.teamA[1]}`); // đồng đội
    bump(`a${m.teamB[0]}-b${m.teamB[1]}`);
    const [x, y] = [m.teamA[0], m.teamB[0]].sort((p, q) => p - q);
    bump(`aa${x}-${y}`); // đối đầu cùng trình A
    const [u, v] = [m.teamA[1], m.teamB[1]].sort((p, q) => p - q);
    bump(`bb${u}-${v}`); // đối đầu cùng trình B
    bump(`a${m.teamA[0]}-b${m.teamB[1]}`); // đối đầu chéo
    bump(`a${m.teamB[0]}-b${m.teamA[1]}`);
  }
  for (const [k, c] of inter) {
    expect(c, `cặp ${k} chạm mặt ${c} lần (${M}+${F})`).toBeLessThanOrEqual(3);
  }
}

describe("generateFullPairCross (vòng tròn ghép cặp)", () => {
  it("6+6 → 18 trận, ai cũng 6 trận", () => verify(6, 6));
  it("6+5 → 15 trận, A 5 trận, B 6 trận", () => verify(6, 5));
  it("5+6 → 15 trận", () => verify(5, 6));
  it("4+4 → 8 trận", () => verify(4, 4));
  it("3+4 → 6 trận", () => verify(3, 4));
  it("7+6 → 21 trận", () => verify(7, 6));
  it("8+8 → 32 trận", () => verify(8, 8));
  it("5+5 (25 cặp lẻ) → null", () => {
    expect(generateFullPairCross(5, 5)).toBeNull();
  });
  it("quá ít/nhiều → null", () => {
    expect(generateFullPairCross(1, 6)).toBeNull();
    expect(generateFullPairCross(9, 4)).toBeNull();
  });
});
