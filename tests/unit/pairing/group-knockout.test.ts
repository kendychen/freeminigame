import { describe, expect, it } from "vitest";
import {
  generateGroupKnockout,
  promoteToKnockout,
  snakeSeedGroups,
} from "@/lib/pairing/group-knockout";
import { makeTeams } from "./fixtures";

describe("snakeSeedGroups", () => {
  it("distributes 8 teams into 2 groups of 4 via snake seed", () => {
    const groups = snakeSeedGroups(makeTeams(8), 4);
    expect(groups.size).toBe(2);
    const groupA = groups.get("A")!;
    const groupB = groups.get("B")!;
    expect(groupA.length).toBe(4);
    expect(groupB.length).toBe(4);
    // Snake: A=[1,4,5,8], B=[2,3,6,7]
    expect(groupA.map((t) => t.id)).toEqual(["t1", "t4", "t5", "t8"]);
    expect(groupB.map((t) => t.id)).toEqual(["t2", "t3", "t6", "t7"]);
  });
});

describe("generateGroupKnockout", () => {
  it("12 teams -> 3 groups of 4 with 6 matches each", () => {
    const result = generateGroupKnockout(makeTeams(12), {
      groupSize: 4,
      qualifyPerGroup: 2,
    });
    expect(result.groups.size).toBe(3);
    for (const matches of result.groups.values()) {
      expect(matches.filter((m) => m.status !== "bye").length).toBe(6);
    }
  });
});

describe("promoteToKnockout", () => {
  it("snake-orders qualifiers across groups", () => {
    const teams = makeTeams(8);
    const qualified = new Map<string, typeof teams>([
      ["A", [teams[0]!, teams[1]!]],
      ["B", [teams[2]!, teams[3]!]],
    ]);
    const knockout = promoteToKnockout(qualified);
    expect(knockout.length).toBe(3); // 4 teams = 3 matches single elim
  });
});
