import { describe, expect, it } from "vitest";
import { generateDoubleElim } from "@/lib/pairing/double-elim";
import { makeTeams } from "./fixtures";

describe("generateDoubleElim", () => {
  it("produces winners + losers + grand_final brackets for N=8", () => {
    const matches = generateDoubleElim(makeTeams(8));
    const sections = new Set(matches.map((m) => m.bracket));
    expect(sections.has("winners")).toBe(true);
    expect(sections.has("losers")).toBe(true);
    expect(sections.has("grand_final")).toBe(true);
  });

  it("total match count >= 2N-2 for N=8", () => {
    const matches = generateDoubleElim(makeTeams(8));
    expect(matches.length).toBeGreaterThanOrEqual(14);
  });

  it("rejects fewer than 2 teams", () => {
    expect(() => generateDoubleElim([])).toThrow();
  });
});
