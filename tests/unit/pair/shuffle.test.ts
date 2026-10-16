import { describe, expect, it } from "vitest";
import {
  shuffleParticipants,
  type PairParticipant,
} from "@/lib/pair/shuffle";

function makeParticipants(
  n: number,
  extra: (i: number) => Partial<PairParticipant> = () => ({}),
): PairParticipant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Người ${i + 1}`,
    joinedAt: 1000 + i,
    ...extra(i),
  }));
}

const flat = (groups: string[][]) => groups.flat();

describe("shuffleParticipants — no pins (backward compatible)", () => {
  it("random_all even count: all in groups, no byes", () => {
    const res = shuffleParticipants(makeParticipants(12), 2, 42, 1);
    expect(res.groups.length).toBe(6);
    expect(res.byes.length).toBe(0);
    expect(new Set(flat(res.groups)).size).toBe(12);
    for (const g of res.groups) expect(g.length).toBe(2);
  });

  it("random_all odd count: leftover goes to byes", () => {
    const res = shuffleParticipants(makeParticipants(11), 2, 7, 1);
    expect(res.groups.length).toBe(5);
    expect(res.byes.length).toBe(1);
    expect(new Set([...flat(res.groups), ...res.byes]).size).toBe(11);
  });

  it("groupSize 3 with remainder 2 → 2 byes", () => {
    const res = shuffleParticipants(makeParticipants(11), 3, 99, 1);
    expect(res.groups.length).toBe(3);
    expect(res.byes.length).toBe(2);
  });

  it("same seed is deterministic", () => {
    const a = shuffleParticipants(makeParticipants(10), 2, 12345, 1);
    const b = shuffleParticipants(makeParticipants(10), 2, 12345, 1);
    expect(b.groups).toEqual(a.groups);
    expect(b.byes).toEqual(a.byes);
  });
});

describe("shuffleParticipants — pinned groups", () => {
  it("a pinned pair is excluded from the pool and comes first", () => {
    const participants = makeParticipants(12, (i) =>
      i < 2 ? { pin: "pin-a" } : {},
    );
    const res = shuffleParticipants(participants, 2, 42, 1);
    expect(res.groups[0]).toEqual(["p1", "p2"]);
    expect(res.groups.length).toBe(6);
    expect(res.byes.length).toBe(0);
    // the pinned ids appear exactly once, only in the locked group
    const rest = res.groups.slice(1).flat();
    expect(rest).not.toContain("p1");
    expect(rest).not.toContain("p2");
    expect(rest.length).toBe(10);
  });

  it("multiple pin groups are all locked, in joinedAt order", () => {
    const participants = makeParticipants(12, (i) => {
      if (i < 2) return { pin: "b" };
      if (i === 4 || i === 5) return { pin: "a" };
      return {};
    });
    const res = shuffleParticipants(participants, 2, 5, 1);
    expect(res.groups[0]).toEqual(["p1", "p2"]);
    expect(res.groups[1]).toEqual(["p5", "p6"]);
    expect(res.groups.length).toBe(6);
  });

  it("a single-member pin is ignored (member stays in the pool)", () => {
    const participants = makeParticipants(4, (i) =>
      i === 0 ? { pin: "solo" } : {},
    );
    const res = shuffleParticipants(participants, 2, 3, 1);
    expect(res.groups.length).toBe(2);
    expect(res.byes.length).toBe(0);
    expect(new Set(flat(res.groups)).size).toBe(4);
    // no group is exactly the solo-pinned member alone
    for (const g of res.groups) expect(g.length).toBe(2);
  });

  it("an oversize pin group is truncated to groupSize, overflow back to pool", () => {
    const participants = makeParticipants(6, (i) =>
      i < 4 ? { pin: "big" } : {},
    );
    const res = shuffleParticipants(participants, 2, 8, 1);
    expect(res.groups[0]).toEqual(["p1", "p2"]);
    expect(res.groups.length).toBe(3);
    expect(res.byes.length).toBe(0);
    const rest = res.groups.slice(1).flat();
    expect(rest.sort()).toEqual(["p3", "p4", "p5", "p6"]);
  });

  it("everyone pinned → only locked groups, empty byes", () => {
    const participants = makeParticipants(4, (i) => ({
      pin: i < 2 ? "x" : "y",
    }));
    const res = shuffleParticipants(participants, 2, 1, 1);
    expect(res.groups).toEqual([
      ["p1", "p2"],
      ["p3", "p4"],
    ]);
    expect(res.byes).toEqual([]);
  });

  it("pin + odd remaining pool still produces byes", () => {
    const participants = makeParticipants(7, (i) =>
      i < 2 ? { pin: "z" } : {},
    );
    const res = shuffleParticipants(participants, 2, 11, 1);
    expect(res.groups[0]).toEqual(["p1", "p2"]);
    expect(res.groups.length).toBe(3);
    expect(res.byes.length).toBe(1);
  });

  it("groupSize 3: a pin of 2 is topped up with one random member", () => {
    const participants = makeParticipants(9, (i) =>
      i < 2 ? { pin: "trio" } : {},
    );
    const res = shuffleParticipants(participants, 3, 21, 1);
    expect(res.groups.length).toBe(3);
    for (const g of res.groups) expect(g.length).toBe(3);
    expect(res.byes.length).toBe(0);
    expect(res.groups[0]).toContain("p1");
    expect(res.groups[0]).toContain("p2");
    expect(new Set(flat(res.groups)).size).toBe(9);
  });

  it("groupSize 4: a pin of 2 is topped up, byes match an unpinned draw", () => {
    const pinned = makeParticipants(12, (i) => (i < 2 ? { pin: "quad" } : {}));
    const res = shuffleParticipants(pinned, 4, 42, 1);
    const plain = shuffleParticipants(makeParticipants(12), 4, 42, 1);
    expect(res.groups.length).toBe(3);
    for (const g of res.groups) expect(g.length).toBe(4);
    expect(res.byes.length).toBe(plain.byes.length);
    expect(res.byes.length).toBe(0);
    expect(res.groups[0]).toContain("p1");
    expect(res.groups[0]).toContain("p2");
    expect(new Set(flat(res.groups)).size).toBe(12);
  });

  it("groupSize 4 with remainder: top-up keeps the bye count intact", () => {
    const pinned = makeParticipants(14, (i) => (i < 2 ? { pin: "quad" } : {}));
    const res = shuffleParticipants(pinned, 4, 9, 1);
    const plain = shuffleParticipants(makeParticipants(14), 4, 9, 1);
    expect(res.groups.length).toBe(3);
    expect(res.byes.length).toBe(plain.byes.length);
    expect(res.byes.length).toBe(2);
    expect(new Set([...flat(res.groups), ...res.byes]).size).toBe(14);
    for (const g of res.groups) expect(g.length).toBe(4);
  });

  it("two short pins in the same draw are both topped up", () => {
    const participants = makeParticipants(12, (i) => {
      if (i < 2) return { pin: "a" };
      if (i === 2 || i === 3) return { pin: "b" };
      return {};
    });
    const res = shuffleParticipants(participants, 3, 33, 1);
    expect(res.groups.length).toBe(4);
    for (const g of res.groups) expect(g.length).toBe(3);
    expect(res.groups[0]).toEqual(expect.arrayContaining(["p1", "p2"]));
    expect(res.groups[1]).toEqual(expect.arrayContaining(["p3", "p4"]));
    expect(new Set(flat(res.groups)).size).toBe(12);
  });

  it("pinned draw is deterministic for the same seed", () => {
    const build = () =>
      makeParticipants(10, (i) => (i < 2 ? { pin: "k" } : {}));
    const a = shuffleParticipants(build(), 2, 777, 1);
    const b = shuffleParticipants(build(), 2, 777, 1);
    expect(b.groups).toEqual(a.groups);
    expect(b.byes).toEqual(a.byes);
  });
});

describe("shuffleParticipants — balanced_by_tag", () => {
  it("keeps every participant exactly once when no pins", () => {
    const participants = makeParticipants(8, (i) => ({
      tag: i % 2 === 0 ? "Nam" : "Nữ",
    }));
    const res = shuffleParticipants(participants, 2, 42, 1, "balanced_by_tag");
    expect(res.groups.length).toBe(4);
    expect(new Set([...flat(res.groups), ...res.byes]).size).toBe(8);
  });

  it("pinned group is locked first, the rest still drawn from the pool", () => {
    const participants = makeParticipants(8, (i) => ({
      tag: i % 2 === 0 ? "Nam" : "Nữ",
      ...(i < 2 ? { pin: "duo" } : {}),
    }));
    const res = shuffleParticipants(participants, 2, 42, 1, "balanced_by_tag");
    expect(res.groups[0]).toEqual(["p1", "p2"]);
    expect(res.groups.length).toBe(4);
    const rest = res.groups.slice(1).flat();
    expect(rest.length).toBe(6);
    expect(rest).not.toContain("p1");
    expect(rest).not.toContain("p2");
    expect(new Set([...rest, ...res.byes]).size).toBe(6);
  });

  it("top-up under balanced_by_tag keeps sizes and loses nobody", () => {
    const participants = makeParticipants(12, (i) => ({
      tag: i % 2 === 0 ? "Nam" : "Nữ",
      ...(i < 2 ? { pin: "duo" } : {}),
    }));
    const res = shuffleParticipants(participants, 4, 42, 1, "balanced_by_tag");
    expect(res.groups.length).toBe(3);
    for (const g of res.groups) expect(g.length).toBe(4);
    expect(res.groups[0]).toEqual(expect.arrayContaining(["p1", "p2"]));
    expect(res.byes.length).toBe(0);
    expect(new Set(flat(res.groups)).size).toBe(12);
  });

  it("mỗi cặp phải có đúng 1 A và 1 B khi số A bằng số B", () => {
    const tagOf = (i: number) => (i % 2 === 0 ? "A" : "B");
    const participants = makeParticipants(8, (i) => ({ tag: tagOf(i) }));
    const byId = new Map(participants.map((p) => [p.id, p.tag]));
    for (let seed = 1; seed <= 60; seed++) {
      const res = shuffleParticipants(
        participants,
        2,
        seed,
        1,
        "balanced_by_tag",
      );
      for (const g of res.groups) {
        const tags = g.map((id) => byId.get(id));
        expect(new Set(tags).size).toBe(2);
      }
    }
  });

  it("nhóm 4 người lấy 2 A + 2 B, không dồn cùng tag", () => {
    const participants = makeParticipants(12, (i) => ({
      tag: i % 2 === 0 ? "A" : "B",
    }));
    const byId = new Map(participants.map((p) => [p.id, p.tag]));
    for (let seed = 1; seed <= 30; seed++) {
      const res = shuffleParticipants(
        participants,
        4,
        seed,
        1,
        "balanced_by_tag",
      );
      for (const g of res.groups) {
        const tags = g.map((id) => byId.get(id));
        expect(tags.filter((t) => t === "A").length).toBe(2);
        expect(tags.filter((t) => t === "B").length).toBe(2);
      }
    }
  });

  it("single tag bucket falls back to plain shuffle", () => {
    const participants = makeParticipants(6, () => ({ tag: "Nam" }));
    const res = shuffleParticipants(participants, 2, 42, 1, "balanced_by_tag");
    const plain = shuffleParticipants(participants, 2, 42, 1, "random_all");
    expect(res.groups).toEqual(plain.groups);
  });
});

describe("shuffleParticipants — split_by_tag (bảng nam & bảng nữ riêng)", () => {
  // 7 nam + 5 nữ → 2 bảng nam (4+3) rồi 1 bảng nữ (5): sĩ số lệch nhau,
  // đúng trường hợp group_size đơn lẻ không diễn tả được.
  const build = () =>
    makeParticipants(12, (i) => ({ tag: i < 7 ? "Nam" : "Nữ" }));
  const plan = [
    { size: 4, tag: "Nam" },
    { size: 3, tag: "Nam" },
    { size: 5, tag: "Nữ" },
  ];

  it("mỗi bảng chỉ chứa người cùng giới, đúng sĩ số kế hoạch", () => {
    const participants = build();
    const tagOf = new Map(participants.map((p) => [p.id, p.tag]));
    const res = shuffleParticipants(participants, 5, 42, 1, "split_by_tag", plan);

    expect(res.groups.map((g) => g.length)).toEqual([4, 3, 5]);
    for (let gi = 0; gi < plan.length; gi++) {
      for (const id of res.groups[gi]!) {
        expect(tagOf.get(id)).toBe(plan[gi]!.tag);
      }
    }
  });

  it("không mất ai và không ai bị xếp 2 bảng", () => {
    const res = shuffleParticipants(build(), 5, 42, 1, "split_by_tag", plan);
    const all = [...flat(res.groups), ...res.byes];
    expect(all.length).toBe(12);
    expect(new Set(all).size).toBe(12);
    expect(res.byes.length).toBe(0);
  });

  it("người thừa của một giới rơi vào byes chứ không lẫn bảng khác giới", () => {
    const participants = makeParticipants(12, (i) => ({
      tag: i < 8 ? "Nam" : "Nữ",
    }));
    const tagOf = new Map(participants.map((p) => [p.id, p.tag]));
    const res = shuffleParticipants(participants, 5, 42, 1, "split_by_tag", plan);

    expect(res.groups.map((g) => g.length)).toEqual([4, 3, 4]);
    expect(res.byes.length).toBe(1);
    expect(tagOf.get(res.byes[0]!)).toBe("Nam");
    for (const id of res.groups[2]!) expect(tagOf.get(id)).toBe("Nữ");
  });

  it("cùng seed cho kết quả giống nhau", () => {
    const a = shuffleParticipants(build(), 5, 999, 1, "split_by_tag", plan);
    const b = shuffleParticipants(build(), 5, 999, 1, "split_by_tag", plan);
    expect(b.groups).toEqual(a.groups);
    expect(b.byes).toEqual(a.byes);
  });

  it("không có plan thì quay về hành vi cũ (không vỡ phiên cũ)", () => {
    const participants = build();
    const res = shuffleParticipants(participants, 4, 42, 1, "split_by_tag");
    const plain = shuffleParticipants(participants, 4, 42, 1, "random_all");
    expect(res.groups).toEqual(plain.groups);
  });
});
