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

  it("single tag bucket falls back to plain shuffle", () => {
    const participants = makeParticipants(6, () => ({ tag: "Nam" }));
    const res = shuffleParticipants(participants, 2, 42, 1, "balanced_by_tag");
    const plain = shuffleParticipants(participants, 2, 42, 1, "random_all");
    expect(res.groups).toEqual(plain.groups);
  });
});
