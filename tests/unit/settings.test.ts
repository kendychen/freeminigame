import { describe, it, expect, vi, beforeEach } from "vitest";

const h: { row: { value: string } | null; error: { message: string } | null } = { row: null, error: null };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.row, error: h.error }) }) }),
    }),
  }),
}));

import { getSetting, maskSecret, isSettingKey } from "@/lib/settings";

describe("settings", () => {
  beforeEach(() => {
    h.row = null;
    h.error = null;
    delete process.env.YOUTUBE_API_KEY;
  });

  it("masks to last 4 chars", () => {
    expect(maskSecret("abcdefgh")).toBe("••••efgh");
    expect(maskSecret("ab")).toBe("••••");
  });
  it("rejects unknown keys", () => {
    expect(isSettingKey("youtube_api_key")).toBe(true);
    expect(isSettingKey("SUPABASE_SERVICE_ROLE_KEY")).toBe(false);
  });
  it("prefers DB over env", async () => {
    h.row = { value: "db-key" };
    process.env.YOUTUBE_API_KEY = "env-key";
    expect(await getSetting("youtube_api_key")).toEqual({ value: "db-key", source: "db" });
  });
  it("falls back to env when DB empty or errored", async () => {
    process.env.YOUTUBE_API_KEY = "env-key";
    expect(await getSetting("youtube_api_key")).toEqual({ value: "env-key", source: "env" });
    h.error = { message: "boom" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getSetting("youtube_api_key")).toEqual({ value: "env-key", source: "env" });
  });
  it("reports none when nothing set", async () => {
    expect(await getSetting("youtube_api_key")).toEqual({ value: undefined, source: "none" });
  });
});
