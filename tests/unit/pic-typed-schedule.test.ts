import { describe, it, expect } from "vitest";
import { generateGenderTypedSchedule } from "@/lib/pic-schedule";

function verify(M: number, F: number, maxInter = 3) {
  const genders: ("M" | "F")[] = [
    ...Array<"M">(M).fill("M"),
    ...Array<"F">(F).fill("F"),
  ];
  const s = generateGenderTypedSchedule(genders);
  expect(s, `schedule for ${M}M/${F}F`).not.toBeNull();
  if (!s) return;

  expect(s.length).toBe(M + F);

  const games = new Array(M + F).fill(0) as number[];
  const partner = new Map<string, number>();
  const inter = new Map<string, number>();
  const k = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  for (const m of s) {
    const teamType = (t: [number, number]) =>
      [genders[t[0]], genders[t[1]]].sort().join("");
    // hai đội cùng phân loại (MM, FF, hoặc FM)
    expect(teamType(m.a)).toBe(teamType(m.b));

    for (const p of [...m.a, ...m.b]) games[p]!++;
    partner.set(k(m.a[0], m.a[1]), (partner.get(k(m.a[0], m.a[1])) ?? 0) + 1);
    partner.set(k(m.b[0], m.b[1]), (partner.get(k(m.b[0], m.b[1])) ?? 0) + 1);
    const pairs: [number, number][] = [
      [m.a[0], m.a[1]], [m.b[0], m.b[1]],
      [m.a[0], m.b[0]], [m.a[0], m.b[1]], [m.a[1], m.b[0]], [m.a[1], m.b[1]],
    ];
    for (const [a, b] of pairs) inter.set(k(a, b), (inter.get(k(a, b)) ?? 0) + 1);
  }

  // mỗi VĐV đúng 4 trận
  for (const g of games) expect(g).toBe(4);
  // không lặp đồng đội
  for (const c of partner.values()) expect(c).toBe(1);
  // không cặp nào chạm mặt quá mức cho phép (mục tiêu 2, nới dần khi hiếm giới)
  for (const c of inter.values()) expect(c).toBeLessThanOrEqual(maxInter);
}

describe("generateGenderTypedSchedule", () => {
  it("6 nam + 6 nữ (12 người, 1 bảng)", () => verify(6, 6));
  it("7 nam + 5 nữ (lệch giới)", () => verify(7, 5));
  it("6 nam + 5 nữ (11 người)", () => verify(6, 5));
  it("5 nam + 5 nữ", () => verify(5, 5));
  it("8 nam + 4 nữ (lệch nhiều)", () => verify(8, 4));
  it("4 nam + 4 nữ (nhỏ nhất có đủ 3 loại)", () => verify(4, 4));
  it("2 nam + 6 nữ (quá ít nam → không có trận đôi nam, 2 nam gặp nhau mọi trận)", () =>
    verify(2, 6, 4));
  it("quá ít người → null", () => {
    expect(generateGenderTypedSchedule(["M", "F", "M"])).toBeNull();
  });
});
