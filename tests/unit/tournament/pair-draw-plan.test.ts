import { describe, it, expect } from "vitest";
import {
  buildPairDrawPlan,
  type PairDrawPlayer,
  type PinnedPair,
} from "@/lib/tournament/pair-draw-plan";

const plain = (n: number): PairDrawPlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, seedTag: null }));

/** n players alternating Nam/Nữ: p1=Nam, p2=Nữ, p3=Nam… */
const tagged = (n: number): PairDrawPlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    seedTag: i % 2 === 0 ? "Nam" : "Nữ",
  }));

const run = (
  players: PairDrawPlayer[],
  teamCount: number,
  pinnedPairs: PinnedPair[] = [],
  balancedByTag = false,
) => buildPairDrawPlan({ players, teamCount, pinnedPairs, balancedByTag });

describe("buildPairDrawPlan — legacy behaviour (no pins)", () => {
  it("splits evenly when players = teamCount * 2", () => {
    const res = run(plain(12), 6);
    expect(res).toEqual({
      ok: true,
      slotSizes: [2, 2, 2, 2, 2, 2],
      slotTags: null,
      assignments: {},
    });
  });

  it("gives the remainder to the FIRST buckets", () => {
    const res = run(plain(7), 3);
    expect(res.ok && res.slotSizes).toEqual([3, 2, 2]);
    const res2 = run(plain(11), 4);
    expect(res2.ok && res2.slotSizes).toEqual([3, 3, 3, 2]);
  });

  it("computes slotTags with Nam on position 1", () => {
    const res = run(tagged(8), 4, [], true);
    expect(res.ok && res.slotTags).toEqual({ "1": "Nam", "2": "Nữ" });
    expect(res.ok && res.assignments).toEqual({});
  });

  it("sorts non-Nam tags alphabetically for the position lock", () => {
    const players: PairDrawPlayer[] = [
      { id: "a", seedTag: "Zulu" },
      { id: "b", seedTag: "Alpha" },
      { id: "c", seedTag: "Zulu" },
      { id: "d", seedTag: "Alpha" },
    ];
    const res = run(players, 2, [], true);
    expect(res.ok && res.slotTags).toEqual({ "1": "Alpha", "2": "Zulu" });
  });
});

describe("buildPairDrawPlan — pins", () => {
  it("puts pins in the LAST buckets (7 players / 3 teams)", () => {
    const res = run(plain(7), 3, [
      ["p1", "p2"],
      ["p3", "p4"],
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.slotSizes).toEqual([3, 2, 2]);
    expect(res.assignments).toEqual({
      p1: { g: 2, p: 1, pinned: true },
      p2: { g: 2, p: 2, pinned: true },
      p3: { g: 1, p: 1, pinned: true },
      p4: { g: 1, p: 2, pinned: true },
    });
  });

  it("handles 12 players / 6 teams with 2 pins", () => {
    const res = run(plain(12), 6, [
      ["p1", "p2"],
      ["p11", "p12"],
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.slotSizes).toEqual([2, 2, 2, 2, 2, 2]);
    expect(res.assignments).toEqual({
      p1: { g: 5, p: 1, pinned: true },
      p2: { g: 5, p: 2, pinned: true },
      p11: { g: 4, p: 1, pinned: true },
      p12: { g: 4, p: 2, pinned: true },
    });
    expect(Object.keys(res.assignments)).toHaveLength(4);
  });

  it("leaves the extra slot open when the pinned bucket is bigger than 2", () => {
    // 5 players / 2 teams → sizes [3, 2]; single pin goes to g=1
    const res = run(plain(5), 2, [["p1", "p2"]]);
    expect(res.ok && res.slotSizes).toEqual([3, 2]);
    expect(res.ok && res.assignments).toEqual({
      p1: { g: 1, p: 1, pinned: true },
      p2: { g: 1, p: 2, pinned: true },
    });

    // 7 players / 3 teams, 3 pins → the 3rd pin lands on g=0 (size 3), p=1/2 only
    const res2 = run(plain(7), 3, [
      ["p1", "p2"],
      ["p3", "p4"],
      ["p5", "p6"],
    ]);
    expect(res2.ok && res2.assignments.p5).toEqual({ g: 0, p: 1, pinned: true });
    expect(res2.ok && res2.assignments.p6).toEqual({ g: 0, p: 2, pinned: true });
  });

  it("orders pinned players by tag when slotTags is active", () => {
    // p2 = Nữ, p1 = Nam → given as [Nữ, Nam], Nam must still take p=1
    const res = run(tagged(8), 4, [["p2", "p1"]], true);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.slotTags).toEqual({ "1": "Nam", "2": "Nữ" });
    expect(res.assignments).toEqual({
      p1: { g: 3, p: 1, pinned: true },
      p2: { g: 3, p: 2, pinned: true },
    });
  });
});

describe("buildPairDrawPlan — errors", () => {
  it("need_at_least_4_players", () => {
    expect(run(plain(3), 2)).toEqual({ ok: false, error: "need_at_least_4_players" });
  });

  it("invalid_team_count", () => {
    expect(run(plain(8), 1)).toEqual({ ok: false, error: "invalid_team_count" });
    expect(run(plain(8), 5)).toEqual({ ok: false, error: "invalid_team_count" });
  });

  it("need_even_players", () => {
    expect(run(tagged(7), 3, [], true)).toEqual({
      ok: false,
      error: "need_even_players",
    });
  });

  it("missing_tag", () => {
    const players = tagged(8);
    players[0] = { id: "p1", seedTag: "  " };
    expect(run(players, 4, [], true)).toEqual({ ok: false, error: "missing_tag" });
  });

  it("tags_unbalanced", () => {
    const players: PairDrawPlayer[] = [
      { id: "a", seedTag: "Nam" },
      { id: "b", seedTag: "Nam" },
      { id: "c", seedTag: "Nam" },
      { id: "d", seedTag: "Nữ" },
    ];
    expect(run(players, 2, [], true)).toEqual({ ok: false, error: "tags_unbalanced" });
  });

  it("pin_invalid — same id twice", () => {
    expect(run(plain(8), 4, [["p1", "p1"]])).toEqual({
      ok: false,
      error: "pin_invalid",
    });
  });

  it("pin_invalid — unknown id", () => {
    expect(run(plain(8), 4, [["p1", "ghost"]])).toEqual({
      ok: false,
      error: "pin_invalid",
    });
  });

  it("pin_duplicate — one player in two pairs", () => {
    expect(
      run(plain(8), 4, [
        ["p1", "p2"],
        ["p2", "p3"],
      ]),
    ).toEqual({ ok: false, error: "pin_duplicate" });
  });

  it("pin_too_many", () => {
    expect(
      run(plain(8), 2, [
        ["p1", "p2"],
        ["p3", "p4"],
        ["p5", "p6"],
      ]),
    ).toEqual({ ok: false, error: "pin_too_many" });
  });

  it("pin_invalid — pinnedPairs is not an array", () => {
    expect(
      run(plain(8), 4, null as unknown as PinnedPair[]),
    ).toEqual({ ok: false, error: "pin_invalid" });
  });

  it("pin_too_many wins over a malformed pair", () => {
    expect(
      run(plain(8), 2, [
        ["p1", "p1"],
        ["p3", "ghost"],
        ["p5", "p6"],
      ]),
    ).toEqual({ ok: false, error: "pin_too_many" });
  });

  it("pin_tag_conflict — two players with the same tag", () => {
    // p1 and p3 are both Nam
    expect(run(tagged(8), 4, [["p1", "p3"]], true)).toEqual({
      ok: false,
      error: "pin_tag_conflict",
    });
  });
});
