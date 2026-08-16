import { describe, it, expect } from "vitest";
import { generateGroupSchedule } from "@/lib/pic-schedule";

// Bất biến của mọi lịch xoay cặp cố định (4–16 người):
// - số trận: n (riêng 4 người: 3 trận)
// - mỗi VĐV đánh đúng số trận như nhau (4 người: 3 trận; còn lại: 4 trận)
// - không lặp đồng đội
// - index hợp lệ, 4 người khác nhau mỗi trận
describe("SCHEDULES invariants (4-16 players)", () => {
  for (let n = 4; n <= 16; n++) {
    it(`${n} người`, () => {
      const s = generateGroupSchedule(n);
      expect(s.length).toBe(n === 4 ? 3 : n);

      const games = new Array(n).fill(0) as number[];
      const partner = new Set<string>();
      const inter = new Map<string, number>();
      const k = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

      for (const m of s) {
        const ids = [m.a[0], m.a[1], m.b[0], m.b[1]];
        expect(new Set(ids).size).toBe(4);
        for (const p of ids) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThan(n);
          games[p]!++;
        }
        const pa = k(m.a[0], m.a[1]);
        const pb = k(m.b[0], m.b[1]);
        expect(partner.has(pa), `lặp đồng đội ${pa} (n=${n})`).toBe(false);
        expect(partner.has(pb), `lặp đồng đội ${pb} (n=${n})`).toBe(false);
        partner.add(pa);
        partner.add(pb);
        const pairs: [number, number][] = [
          [m.a[0], m.a[1]], [m.b[0], m.b[1]],
          [m.a[0], m.b[0]], [m.a[0], m.b[1]], [m.a[1], m.b[0]], [m.a[1], m.b[1]],
        ];
        for (const [a, b] of pairs) inter.set(k(a, b), (inter.get(k(a, b)) ?? 0) + 1);
      }

      const expected = n === 4 ? 3 : 4;
      for (const g of games) expect(g).toBe(expected);

      // lịch 11-16 (sinh bằng thuật toán cân bằng): không cặp nào chạm mặt >2 lần
      if (n >= 11) {
        for (const c of inter.values()) expect(c).toBeLessThanOrEqual(2);
      }
    });
  }
});
