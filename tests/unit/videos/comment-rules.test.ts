import { describe, it, expect } from "vitest";
import { normalizeComment, isRateLimited } from "@/lib/videos/comment-rules";

describe("normalizeComment", () => {
  it("trims and rejects empty/too long", () => {
    expect(normalizeComment("  hi  ")).toEqual({ ok: true, body: "hi" });
    expect(normalizeComment("   ")).toEqual({ ok: false, error: "comment_empty" });
    expect(normalizeComment("x".repeat(501))).toEqual({ ok: false, error: "comment_too_long" });
  });
});
describe("isRateLimited", () => {
  const now = Date.parse("2026-01-01T00:01:00Z");
  it("limits at 3 comments within 60s", () => {
    const t = (s: number) => new Date(now - s * 1000).toISOString();
    expect(isRateLimited([t(10), t(20)], now)).toBe(false);
    expect(isRateLimited([t(10), t(20), t(30)], now)).toBe(true);
    expect(isRateLimited([t(10), t(20), t(70)], now)).toBe(false);
  });
});
