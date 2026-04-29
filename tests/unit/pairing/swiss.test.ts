import { describe, expect, it } from "vitest";
import {
  buildSwissHistory,
  generateSwissRound,
} from "@/lib/pairing/swiss";
import type { Match } from "@/lib/pairing/types";
import { makeTeams } from "./fixtures";

describe("Swiss pairing", () => {
  it("round 1 pairs all teams (no history)", () => {
    const teams = makeTeams(8);
    const history = buildSwissHistory(teams, []);
    const matches = generateSwissRound(teams, history, 1);
    expect(matches.length).toBe(4);
    const seen = new Set<string>();
    for (const m of matches) {
      if (!m.teamA || !m.teamB) continue;
      seen.add(m.teamA);
      seen.add(m.teamB);
    }
    expect(seen.size).toBe(8);
  });

  it("avoids prior opponents in subsequent rounds", () => {
    const teams = makeTeams(8);
    let history = buildSwissHistory(teams, []);
    const r1 = generateSwissRound(teams, history, 1);
    // Simulate completing all r1 matches: team1 wins half, team2 wins half
    const completed: Match[] = r1.map((m, i) =>
      m.teamA && m.teamB
        ? {
            ...m,
            scoreA: i % 2 === 0 ? 3 : 1,
            scoreB: i % 2 === 0 ? 1 : 3,
            winner: i % 2 === 0 ? m.teamA : m.teamB,
            status: "completed" as const,
          }
        : m,
    );
    history = buildSwissHistory(teams, completed);
    const r2 = generateSwissRound(teams, history, 2);
    // Verify no rematch
    for (const m of r2) {
      if (!m.teamA || !m.teamB) continue;
      const aHistory = history.get(m.teamA);
      expect(aHistory?.opponentIds).not.toContain(m.teamB);
    }
  });

  it("handles odd N with bye", () => {
    const teams = makeTeams(7);
    const history = buildSwissHistory(teams, []);
    const r1 = generateSwissRound(teams, history, 1);
    const byes = r1.filter((m) => m.status === "bye");
    expect(byes.length).toBe(1);
  });
});
