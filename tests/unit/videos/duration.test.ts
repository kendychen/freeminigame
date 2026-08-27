import { describe, it, expect } from "vitest";
import { parseIsoDuration } from "@/lib/videos/duration";

describe("parseIsoDuration", () => {
  it("parses seconds/minutes/hours", () => {
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT3M")).toBe(180);
    expect(parseIsoDuration("PT1M30S")).toBe(90);
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("P1DT1S")).toBe(86401);
  });
  it("returns 0 for garbage", () => {
    expect(parseIsoDuration("")).toBe(0);
    expect(parseIsoDuration("abc")).toBe(0);
  });
});
