import { describe, it, expect } from "vitest";
import type { PairParticipant } from "@/lib/pair/shuffle";
import {
  drawNextGroup,
  drawAllRemaining,
  remainingPool,
  toPairResult,
  type StepDrawState,
} from "@/lib/pair/step-draw";

function people(n: number, pins: Record<number, string> = {}): PairParticipant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Người ${i + 1}`,
    joinedAt: 1000 + i,
    pin: pins[i + 1] ?? null,
  }));
}

const empty: StepDrawState = { groups: [], byes: [] };

describe("drawNextGroup", () => {
  it("rút đúng groupSize người mỗi lượt, không trùng ai", () => {
    const ps = people(8);
    let st = empty;
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const out = drawNextGroup(ps, 2, st, 12345 + i);
      expect(out.group).not.toBeNull();
      expect(out.group!).toHaveLength(2);
      for (const id of out.group!) {
        expect(seen.has(id), `${id} bị chia 2 lần`).toBe(false);
        seen.add(id);
      }
      st = out.next;
    }
    expect(seen.size).toBe(8);
    expect(st.byes).toEqual([]);
  });

  it("báo done khi hết người", () => {
    const ps = people(4);
    let st = empty;
    const a = drawNextGroup(ps, 2, st, 1);
    expect(a.done).toBe(false);
    st = a.next;
    const b = drawNextGroup(ps, 2, st, 2);
    expect(b.done).toBe(true);
  });

  it("số lẻ: người cuối thành bye, không treo vòng quay", () => {
    const ps = people(5);
    const { next } = drawAllRemaining(ps, 2, empty, 777);
    expect(next.groups).toHaveLength(2);
    expect(next.byes).toHaveLength(1);
    const all = [...next.groups.flat(), ...next.byes];
    expect(new Set(all).size).toBe(5);
  });

  it("nhóm ghim được công bố trước và đánh dấu fromPin", () => {
    const ps = people(6, { 2: "x", 5: "x" });
    const out = drawNextGroup(ps, 2, empty, 42);
    expect(out.fromPin).toBe(true);
    expect(out.group!.sort()).toEqual(["p2", "p5"]);
  });

  it("người đã ghim không nằm trong pool chờ quay", () => {
    const ps = people(6, { 2: "x", 5: "x" });
    const pool = remainingPool(ps, 2, empty).map((p) => p.id);
    expect(pool).not.toContain("p2");
    expect(pool).not.toContain("p5");
    expect(pool).toHaveLength(4);
  });

  it("nhóm ghim thiếu người thì lấp thêm từ pool", () => {
    const ps = people(6, { 1: "x", 3: "x" });
    const out = drawNextGroup(ps, 3, empty, 9);
    expect(out.group!).toHaveLength(3);
    expect(out.group!).toContain("p1");
    expect(out.group!).toContain("p3");
  });

  it("groupSize < 2 thì không quay", () => {
    const out = drawNextGroup(people(4), 1, empty, 1);
    expect(out.group).toBeNull();
    expect(out.done).toBe(true);
  });

  it("pool rỗng thì kết thúc, không lặp vô hạn", () => {
    const out = drawNextGroup([], 2, empty, 1);
    expect(out.group).toBeNull();
    expect(out.done).toBe(true);
  });
});

describe("drawAllRemaining", () => {
  it("quay tiếp phần còn lại sau khi đã quay tay vài nhóm", () => {
    const ps = people(8);
    const first = drawNextGroup(ps, 2, empty, 5);
    const { next, added } = drawAllRemaining(ps, 2, first.next, 5);
    expect(added).toHaveLength(3);
    expect(next.groups).toHaveLength(4);
    expect(new Set(next.groups.flat()).size).toBe(8);
  });

  it("không ai bị chia hai lần khi phát ra tất", () => {
    const ps = people(12, { 3: "k", 7: "k" });
    const { next } = drawAllRemaining(ps, 3, empty, 2026);
    const flat = next.groups.flat();
    expect(new Set(flat).size).toBe(flat.length);
    expect([...flat, ...next.byes].sort()).toEqual(ps.map((p) => p.id).sort());
  });

  it("toPairResult giữ nguyên nhóm và bye", () => {
    const ps = people(5);
    const { next } = drawAllRemaining(ps, 2, empty, 3);
    const res = toPairResult(next, 1);
    expect(res.round).toBe(1);
    expect(res.groups).toEqual(next.groups);
    expect(res.byes).toEqual(next.byes);
  });
});
