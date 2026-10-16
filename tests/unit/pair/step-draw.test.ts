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

/** Người tham gia có tag, kèm pin tuỳ chọn theo số thứ tự (1-based). */
function tagged(
  tags: string[],
  pins: Record<number, string> = {},
): PairParticipant[] {
  return tags.map((tag, i) => ({
    id: `p${i + 1}`,
    name: `Người ${i + 1}`,
    joinedAt: 1000 + i,
    tag,
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

  it("balanced_by_tag: mọi cặp đều A-B khi số A bằng số B", () => {
    const ps = tagged(["A", "B", "A", "B", "A", "B", "A", "B"]);
    const tagOf = new Map(ps.map((p) => [p.id, p.tag]));
    for (let seed = 1; seed <= 40; seed++) {
      const { next } = drawAllRemaining(ps, 2, empty, seed, "balanced_by_tag");
      expect(next.groups).toHaveLength(4);
      for (const g of next.groups) {
        expect(new Set(g.map((id) => tagOf.get(id))).size).toBe(2);
      }
    }
  });

  it("balanced_by_tag: phần dư ghép cùng tag chứ không thành bye", () => {
    // 6 A + 2 B → 2 cặp A-B, 2 cặp A-A. Không ai bị loại.
    const ps = tagged(["A", "A", "A", "A", "A", "A", "B", "B"]);
    const tagOf = new Map(ps.map((p) => [p.id, p.tag]));
    for (let seed = 1; seed <= 40; seed++) {
      const { next } = drawAllRemaining(ps, 2, empty, seed, "balanced_by_tag");
      expect(next.groups).toHaveLength(4);
      expect(next.byes).toEqual([]);
      const mixed = next.groups.filter(
        (g) => new Set(g.map((id) => tagOf.get(id))).size === 2,
      );
      expect(mixed).toHaveLength(2);
    }
  });

  it("balanced_by_tag: nhóm 4 người lấy 2 A + 2 B", () => {
    const ps = tagged(["A", "B", "A", "B", "A", "B", "A", "B"]);
    const tagOf = new Map(ps.map((p) => [p.id, p.tag]));
    for (let seed = 1; seed <= 30; seed++) {
      const { next } = drawAllRemaining(ps, 4, empty, seed, "balanced_by_tag");
      expect(next.groups).toHaveLength(2);
      for (const g of next.groups) {
        const tags = g.map((id) => tagOf.get(id));
        expect(tags.filter((t) => t === "A")).toHaveLength(2);
        expect(tags.filter((t) => t === "B")).toHaveLength(2);
      }
    }
  });

  it("balanced_by_tag: cặp ghim vẫn thắng, không bị tag can thiệp", () => {
    // p1 và p3 cùng tag A nhưng được ghim → phải ở cùng cặp.
    const ps = tagged(["A", "B", "A", "B", "A", "B"], { 1: "k", 3: "k" });
    for (let seed = 1; seed <= 20; seed++) {
      const { next } = drawAllRemaining(ps, 2, empty, seed, "balanced_by_tag");
      const g = next.groups.find((x) => x.includes("p1"))!;
      expect(g).toContain("p3");
    }
  });

  it("không truyền mode thì giữ nguyên hành vi random cũ", () => {
    const ps = tagged(["A", "B", "A", "B", "A", "B"]);
    const a = drawAllRemaining(ps, 2, empty, 4242);
    const b = drawAllRemaining(ps, 2, empty, 4242, "random_all");
    expect(b.next.groups).toEqual(a.next.groups);
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
