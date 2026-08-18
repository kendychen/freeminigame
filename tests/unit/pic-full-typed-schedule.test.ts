import { describe, it, expect } from "vitest";
import { generateFullTypedSchedule } from "@/lib/pic-schedule";

const C2 = (n: number) => (n * (n - 1)) / 2;

function expectedMatches(M: number, F: number) {
  const md = M >= 4 ? Math.floor(C2(M) / 2) : 0;
  const wd = F >= 4 ? Math.floor(C2(F) / 2) : 0;
  const xd = M >= 2 && F >= 2 ? Math.floor((M * F) / 2) : 0;
  return { md, wd, xd, total: md + wd + xd };
}

function verify(M: number, F: number) {
  const genders: ("M" | "F")[] = [
    ...Array<"M">(M).fill("M"),
    ...Array<"F">(F).fill("F"),
  ];
  const s = generateFullTypedSchedule(genders);
  expect(s, `${M}+${F}`).not.toBeNull();
  if (!s) return;

  const exp = expectedMatches(M, F);
  expect(s.length, `${M}+${F} tổng trận`).toBe(exp.total);

  const isM = (i: number) => genders[i] === "M";
  const teamType = (t: [number, number]) => {
    const m = Number(isM(t[0])) + Number(isM(t[1]));
    return m === 2 ? "MD" : m === 0 ? "WD" : "XD";
  };

  const partnered = new Set<string>();
  const counts = { MD: 0, WD: 0, XD: 0 };
  const inter = new Map<string, number>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const bump = (a: number, b: number) => inter.set(key(a, b), (inter.get(key(a, b)) ?? 0) + 1);

  for (const m of s) {
    // 2 đội cùng loại trận, 4 người khác nhau
    const tA = teamType(m.a);
    const tB = teamType(m.b);
    expect(tA, `${M}+${F} trận lệch loại`).toBe(tB);
    counts[tA]++;
    const ids = new Set([...m.a, ...m.b]);
    expect(ids.size).toBe(4);

    // đồng đội không lặp
    for (const t of [m.a, m.b]) {
      const k = key(t[0], t[1]);
      expect(partnered.has(k), `cặp ${k} lặp (${M}+${F})`).toBe(false);
      partnered.add(k);
      bump(t[0], t[1]);
    }
    // đối đầu
    bump(m.a[0], m.b[0]);
    bump(m.a[0], m.b[1]);
    bump(m.a[1], m.b[0]);
    bump(m.a[1], m.b[1]);
  }

  expect(counts.MD).toBe(exp.md);
  expect(counts.WD).toBe(exp.wd);
  expect(counts.XD).toBe(exp.xd);

  // Phủ cặp: dùng đúng số cặp mỗi loại (lẻ thì thiếu đúng 1)
  expect(partnered.size).toBe(2 * exp.total);

  // Cân bằng chạm mặt: mọi cặp VĐV (đồng đội + đối đầu) không quá 7 lần
  for (const [k, c] of inter) {
    expect(c, `cặp ${k} chạm mặt ${c} lần (${M}+${F})`).toBeLessThanOrEqual(7);
  }
}

describe("generateFullTypedSchedule (trận cùng loại đầy đủ)", () => {
  it("6+6 → 7 MD + 7 WD + 18 XD = 32 trận", () => verify(6, 6));
  it("6+5 → 7 MD + 5 WD + 15 XD = 27 trận", () => verify(6, 5));
  it("4+4 → 3 + 3 + 8 = 14 trận", () => verify(4, 4));
  it("5+4 → 5 + 3 + 10 = 18 trận", () => verify(5, 4));
  it("8+8 → 14 + 14 + 32 = 60 trận", () => verify(8, 8));
  it("2+2 → chỉ 2 trận nam-nữ", () => verify(2, 2));
  it("3+4 → không đôi nam (3 nam), có đôi nữ + nam-nữ", () => verify(3, 4));
  it("12+0 → toàn đôi nam, 33 trận", () => verify(12, 0));
  it("0+8 → toàn đôi nữ, 14 trận", () => verify(0, 8));
  it("7+6 → 10 + 7 + 21 = 38 trận", () => verify(7, 6));
  it("1 nam đơn độc → null", () => {
    expect(generateFullTypedSchedule(["M", "F", "F", "F", "F"])).toBeNull();
  });
  it("quá ít/nhiều người → null", () => {
    expect(generateFullTypedSchedule(["M", "M", "F"])).toBeNull();
    expect(
      generateFullTypedSchedule([
        ...Array<"M">(9).fill("M"),
        ...Array<"F">(8).fill("F"),
      ]),
    ).toBeNull();
  });
});
