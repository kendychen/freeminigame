import { readFileSync } from "node:fs";
import path from "node:path";
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
  it("migration seeds exactly the taxonomy slugs", () => {
    const sql = readFileSync(
      path.resolve(__dirname, "../../../supabase/migrations/0036_technique_videos.sql"),
      "utf8",
    );
    const seeded = [...sql.matchAll(/\('([a-z-]+)'\)/g)].map((m) => m[1]);
    expect(new Set(seeded)).toEqual(new Set(TECHNIQUES.map((t) => t.slug)));
  });
});
