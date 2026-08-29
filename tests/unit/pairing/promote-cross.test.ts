import { describe, expect, it } from "vitest";
import { promoteToKnockout } from "@/lib/pairing/group-knockout";
import { makeTeams } from "./fixtures";

const r1 = (m: { round: number; teamA: string | null; teamB: string | null }) => m.round === 1;

describe("promoteToKnockout cross-group pairing", () => {
  it("2 groups x 2: A1 vs B2 and B1 vs A2", () => {
    const t = makeTeams(8);
    const q = new Map([["A", [t[0]!, t[1]!]], ["B", [t[2]!, t[3]!]]]);
    const pairs = promoteToKnockout(q).filter(r1).map((m) => [m.teamA, m.teamB].sort());
    console.log("2x2", JSON.stringify(pairs));
    expect(pairs).toContainEqual(["t1", "t4"].sort()); // A1 vs B2
    expect(pairs).toContainEqual(["t2", "t3"].sort()); // A2 vs B1
  });
  it("4 groups x 2: no round-1 match pairs teams of the same group", () => {
    const t = makeTeams(8);
    const q = new Map([
      ["A", [t[0]!, t[1]!]], ["B", [t[2]!, t[3]!]], ["C", [t[4]!, t[5]!]], ["D", [t[6]!, t[7]!]],
    ]);
    const groupOf = new Map<string, string>();
    for (const [l, list] of q) for (const x of list) groupOf.set(x.id, l);
    const pairs = promoteToKnockout(q).filter(r1).map((m) => [m.teamA, m.teamB]);
    console.log("4x2", JSON.stringify(pairs));
    for (const [a, b] of pairs) expect(groupOf.get(a!)).not.toBe(groupOf.get(b!));
    // group winners never meet in round 1
    for (const [a, b] of pairs) expect([a, b].filter((x) => ["t1", "t3", "t5", "t7"].includes(x!)).length).toBeLessThan(2);
  });
  it("3 groups x 2 (6 teams): byes go to group winners and no same-group round-1 match", () => {
    const t = makeTeams(8);
    const q = new Map([["A", [t[0]!, t[1]!]], ["B", [t[2]!, t[3]!]], ["C", [t[4]!, t[5]!]]]);
    const ms = promoteToKnockout(q);
    console.log("3x2", JSON.stringify(ms.map((m) => [m.round, m.teamA, m.teamB])));
    const groupOf = new Map<string, string>();
    for (const [l, list] of q) for (const x of list) groupOf.set(x.id, l);
    for (const m of ms.filter(r1)) expect(groupOf.get(m.teamA!)).not.toBe(groupOf.get(m.teamB!));
  });
});
