import { describe, expect, it } from "vitest";
import {
  generateSingleElim,
  resolveByes,
  advanceWinner,
} from "@/lib/pairing/single-elim";
import { makeTeams } from "./fixtures";

describe("generateSingleElim", () => {
  it("generates N-1 matches for power-of-2 N", () => {
    for (const n of [2, 4, 8, 16, 32]) {
      const matches = generateSingleElim(makeTeams(n));
      expect(matches.length).toBe(n - 1);
    }
  });

  it("encodes implicit byes by seating top seeds directly into round 2", () => {
    // For N=13, lib produces 5 round-1 matches (10 teams), and 3 round-2 matches
    // already have one team pre-filled (the byed top seeds).
    const matches = generateSingleElim(makeTeams(13));
    const r2Filled = matches.filter(
      (m) => m.round === 2 && (m.teamA !== null) !== (m.teamB !== null),
    );
    expect(r2Filled.length).toBe(3);
  });

  it("rejects fewer than 2 teams", () => {
    expect(() => generateSingleElim([])).toThrow();
    expect(() => generateSingleElim(makeTeams(1))).toThrow();
  });

  it("rounds count = ceil(log2(N))", () => {
    for (const n of [4, 8, 13, 16]) {
      const matches = generateSingleElim(makeTeams(n));
      const maxRound = Math.max(...matches.map((m) => m.round));
      expect(maxRound).toBe(Math.ceil(Math.log2(n)));
    }
  });

  it("links nextWinId for non-final rounds", () => {
    const matches = generateSingleElim(makeTeams(8));
    const finalRound = Math.max(...matches.map((m) => m.round));
    const nonFinal = matches.filter((m) => m.round < finalRound);
    expect(nonFinal.every((m) => m.nextWinId !== undefined)).toBe(true);
    const finals = matches.filter((m) => m.round === finalRound);
    expect(finals.every((m) => m.nextWinId === undefined)).toBe(true);
  });
});

describe("advanceWinner", () => {
  it("places winner into next match's open slot", () => {
    let matches = generateSingleElim(makeTeams(4));
    const r1m1 = matches.find((m) => m.round === 1 && m.matchNumber === 1)!;
    matches = matches.map((m) =>
      m.id === r1m1.id
        ? { ...m, scoreA: 3, scoreB: 1, winner: m.teamA, status: "completed" }
        : m,
    );
    matches = advanceWinner(matches, r1m1.id);
    const next = matches.find((m) => m.id === r1m1.nextWinId)!;
    expect(next.teamA).toBe(r1m1.teamA);
  });
});

describe("resolveByes", () => {
  it("is a no-op for tournament-pairings output (byes are implicit)", () => {
    const matches = generateSingleElim(makeTeams(5));
    const after = resolveByes(matches);
    expect(after.length).toBe(matches.length);
  });
});
