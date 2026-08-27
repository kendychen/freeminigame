import { describe, it, expect, vi } from "vitest";
import { mapVideoItem, searchVideos, getVideoDetails, YoutubeError } from "@/lib/videos/youtube";

const item = {
  id: "abc",
  snippet: { title: "T", description: "D", channelTitle: "C", publishedAt: "2024-01-01T00:00:00Z" },
  contentDetails: { duration: "PT2M", regionRestriction: { blocked: ["VN"] } },
  statistics: { viewCount: "123" },
  status: { embeddable: true },
};

describe("mapVideoItem", () => {
  it("maps fields", () => {
    expect(mapVideoItem(item)).toEqual({
      id: "abc", title: "T", description: "D", channelTitle: "C",
      publishedAt: "2024-01-01T00:00:00Z", durationSec: 120, viewCount: 123,
      embeddable: true, blockedRegions: ["VN"],
    });
  });
  it("returns null when id/snippet missing", () => {
    expect(mapVideoItem({})).toBeNull();
  });
});

describe("searchVideos", () => {
  it("returns ids with rank and sends key + regionCode", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    const f = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ items: [{ id: { videoId: "a" } }, { id: { videoId: "b" } }] }),
    })) as unknown as typeof fetch;
    const r = await searchVideos("pickleball dink tutorial", f);
    expect(r).toEqual([{ id: "a", rank: 0 }, { id: "b", rank: 1 }]);
    const url = String(vi.mocked(f).mock.calls[0]?.[0]);
    expect(url).toContain("regionCode=VN");
    expect(url).toContain("key=k");
  });
  it("throws YoutubeError on quota", async () => {
    const f = vi.fn(async () => ({
      ok: false, status: 403,
      json: async () => ({ error: { errors: [{ reason: "quotaExceeded" }] } }),
    })) as unknown as typeof fetch;
    await expect(searchVideos("x", f)).rejects.toBeInstanceOf(YoutubeError);
  });
});

describe("getVideoDetails", () => {
  it("returns [] for empty ids without fetching", async () => {
    const f = vi.fn() as unknown as typeof fetch;
    expect(await getVideoDetails([], f)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});
