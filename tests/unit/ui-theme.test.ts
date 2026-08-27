import { describe, it, expect, vi, beforeEach } from "vitest";

const h: { row: { value: unknown } | null; error: { message: string } | null; throws: boolean } = {
  row: null, error: null, throws: false,
};
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    if (h.throws) throw new Error("env missing");
    return {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.row, error: h.error }) }) }),
      }),
    };
  },
}));

import { getUiTheme, parseUiTheme } from "@/lib/ui-theme";

describe("ui-theme", () => {
  beforeEach(() => {
    h.row = null; h.error = null; h.throws = false;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("parses {theme} objects and bare strings, defaulting to v1", () => {
    expect(parseUiTheme({ theme: "v2" })).toBe("v2");
    expect(parseUiTheme("v2")).toBe("v2");
    expect(parseUiTheme({ theme: "v9" })).toBe("v1");
    expect(parseUiTheme(null)).toBe("v1");
  });

  it("reads v2 from site_settings", async () => {
    h.row = { value: { theme: "v2" } };
    expect(await getUiTheme()).toBe("v2");
  });

  it("falls back to v1 on DB error or thrown client", async () => {
    h.error = { message: "boom" };
    expect(await getUiTheme()).toBe("v1");
    h.throws = true;
    expect(await getUiTheme()).toBe("v1");
  });
});
