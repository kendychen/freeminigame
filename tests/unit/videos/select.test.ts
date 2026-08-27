import { describe, it, expect } from "vitest";
import { filterCandidates, selectVideos } from "@/lib/videos/select";
import type { YtVideo } from "@/lib/videos/youtube";

const base = (over: Partial<YtVideo>): YtVideo => ({
  id: "x", title: "t", description: "", channelTitle: "c", publishedAt: "2024-01-01T00:00:00Z",
  durationSec: 300, viewCount: 10, likeCount: 1, commentCount: 0, embeddable: true, blockedRegions: [], ...over,
});

describe("filterCandidates", () => {
  it("drops shorts, non-embeddable, VN-blocked, and ids not in ranked list", () => {
    const details = [
      base({ id: "a" }), base({ id: "b", durationSec: 30 }), base({ id: "c", embeddable: false }),
      base({ id: "d", blockedRegions: ["VN"] }), base({ id: "pinned-only" }),
    ];
    const ranked = [{ id: "a", rank: 0 }, { id: "b", rank: 1 }, { id: "c", rank: 2 }, { id: "d", rank: 3 }];
    expect(filterCandidates(details, ranked).map((v) => v.id)).toEqual(["a"]);
  });
});

describe("selectVideos", () => {
  it("keeps tutorial with score>=60 and matching technique, sorted by score then rank, limited", () => {
    const cands = [
      { ...base({ id: "a" }), rank: 2 }, { ...base({ id: "b" }), rank: 0 },
      { ...base({ id: "c" }), rank: 1 }, { ...base({ id: "d" }), rank: 3 },
    ];
    const cls = [
      { id: "a", isTutorial: true, score: 90, technique: "dink", level: "basic" as const, summaryVi: "s" },
      { id: "b", isTutorial: true, score: 90, technique: "dink", level: "advanced" as const, summaryVi: "s" },
      { id: "c", isTutorial: true, score: 59, technique: "dink", level: "basic" as const, summaryVi: "s" },
      { id: "d", isTutorial: true, score: 95, technique: "volley", level: "basic" as const, summaryVi: "s" },
    ];
    const out = selectVideos("dink", cands, cls, 1);
    expect(out.map((v) => v.videoId)).toEqual(["b"]);
    expect(selectVideos("dink", cands, cls).map((v) => v.videoId)).toEqual(["b", "a"]);
  });
});
