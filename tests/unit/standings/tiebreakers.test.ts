import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/lib/standings/tiebreakers";

describe("mulberry32", () => {
  it("is deterministic for same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 5; i++) {
      expect(a()).toBe(b());
    }
  });
  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
});
