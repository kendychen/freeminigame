import { describe, it, expect } from "vitest";
import { TECHNIQUES, isTechniqueSlug, getTechnique } from "@/lib/videos/techniques";

describe("TECHNIQUES", () => {
  it("has 12 unique slugs with vi/en names and a query", () => {
    expect(TECHNIQUES).toHaveLength(12);
    expect(new Set(TECHNIQUES.map((t) => t.slug)).size).toBe(12);
    for (const t of TECHNIQUES) {
      expect(t.nameVi.length).toBeGreaterThan(0);
      expect(t.nameEn.length).toBeGreaterThan(0);
      expect(t.query).toMatch(/pickleball/);
    }
  });
  it("guards slugs", () => {
    expect(isTechniqueSlug("dink")).toBe(true);
    expect(isTechniqueSlug("nope")).toBe(false);
    expect(getTechnique("erne").nameEn).toBe("Erne");
  });
});
