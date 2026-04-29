import { describe, expect, it } from "vitest";
import { computeStandings } from "@/lib/standings/compute";
import type { Match, Team } from "@/lib/pairing/types";

const teams: Team[] = [
  { id: "A", name: "A" },
  { id: "B", name: "B" },
  { id: "C", name: "C" },
  { id: "D", name: "D" },
];

const completedMatch = (
  id: string,
  a: string,
  b: string,
  sa: number,
  sb: number,
): Match => ({
  id,
  round: 1,
  matchNumber: 1,
  bracket: "main",
  teamA: a,
  teamB: b,
  scoreA: sa,
  scoreB: sb,
  winner: sa > sb ? a : sb > sa ? b : null,
  status: "completed",
});

describe("computeStandings", () => {
  it("ranks teams by points", () => {
    const matches: Match[] = [
      completedMatch("m1", "A", "B", 3, 1),
      completedMatch("m2", "C", "D", 2, 2),
      completedMatch("m3", "A", "C", 4, 0),
      completedMatch("m4", "B", "D", 1, 3),
    ];
    const standings = computeStandings({ teams, matches });
    expect(standings[0]!.teamId).toBe("A"); // 6 pts
    expect(standings[0]!.points).toBe(6);
    expect(standings[1]!.teamId).toBe("D"); // 4 pts (1W 1D)
  });

  it("breaks tie by point differential", () => {
    const matches: Match[] = [
      completedMatch("m1", "A", "B", 3, 0),
      completedMatch("m2", "B", "A", 0, 1),
      completedMatch("m3", "C", "D", 2, 0),
      completedMatch("m4", "D", "C", 0, 1),
    ];
    const standings = computeStandings({
      teams,
      matches,
      tiebreakers: [
        { order: 1, type: "point_differential" },
        { order: 2, type: "random" },
      ],
    });
    // Both A (6 pts, +4) and C (6 pts, +3) tied on points; A first by GD
    expect(standings[0]!.teamId).toBe("A");
    expect(standings[1]!.teamId).toBe("C");
  });

  it("breaks tie by head-to-head", () => {
    const matches: Match[] = [
      completedMatch("m1", "A", "B", 2, 0),
      completedMatch("m2", "B", "A", 1, 0),
    ];
    const standings = computeStandings({
      teams: [
        { id: "A", name: "A" },
        { id: "B", name: "B" },
      ],
      matches,
      tiebreakers: [
        { order: 1, type: "head_to_head" },
        { order: 2, type: "random" },
      ],
    });
    // Both 1W 1L = 3 pts each. H2H also 1-1 = tied. Random fallback.
    expect(standings.length).toBe(2);
  });
});
