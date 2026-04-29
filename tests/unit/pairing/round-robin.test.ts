import { describe, expect, it } from "vitest";
import { generateRoundRobin } from "@/lib/pairing/round-robin";
import { makeTeams } from "./fixtures";

describe("generateRoundRobin", () => {
  it("N=4 yields 6 matches in 3 rounds", () => {
    const matches = generateRoundRobin(makeTeams(4));
    expect(matches.filter((m) => m.status !== "bye").length).toBe(6);
    const rounds = new Set(matches.map((m) => m.round));
    expect(rounds.size).toBe(3);
  });

  it("N=8 yields 28 matches in 7 rounds", () => {
    const matches = generateRoundRobin(makeTeams(8));
    expect(matches.filter((m) => m.status !== "bye").length).toBe(28);
    const rounds = new Set(matches.map((m) => m.round));
    expect(rounds.size).toBe(7);
  });

  it("odd N=5 produces byes (1 per round)", () => {
    const matches = generateRoundRobin(makeTeams(5));
    const rounds = new Set(matches.map((m) => m.round));
    expect(rounds.size).toBe(5);
    for (const r of rounds) {
      const inRound = matches.filter((m) => m.round === r);
      const byes = inRound.filter((m) => m.status === "bye");
      expect(byes.length).toBe(1);
    }
  });

  it("doubleRound doubles the schedule", () => {
    const single = generateRoundRobin(makeTeams(4));
    const dbl = generateRoundRobin(makeTeams(4), { doubleRound: true });
    expect(dbl.length).toBe(single.length * 2);
  });

  it("each pair meets exactly once in single round", () => {
    const matches = generateRoundRobin(makeTeams(6));
    const seen = new Set<string>();
    for (const m of matches) {
      if (!m.teamA || !m.teamB) continue;
      const key = [m.teamA, m.teamB].sort().join("|");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
