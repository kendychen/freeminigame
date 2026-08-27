import { describe, it, expect } from "vitest";
import { mergeCards, thumbnailUrl } from "@/lib/videos/queries";

const row = (video_id: string, ai_score: number, view_count = 0) => ({
  technique: "dink", video_id, title: "t", channel_title: "c", duration_sec: 100, view_count,
  published_at: "2024-01-01", rank: 0, ai_score, ai_level: "basic", ai_summary_vi: "s", last_seen_at: "", created_at: "",
});

describe("mergeCards", () => {
  it("hides hidden/gone, pins first, then score, then views", () => {
    const out = mergeCards(
      [row("a", 90), row("b", 95), row("c", 99), row("d", 50, 999), row("e", 50, 1)],
      [{ technique: "dink", video_id: "a", status: null, pinned: true },
       { technique: "dink", video_id: "c", status: "hidden", pinned: false }],
      [{ technique: "dink", video_id: "b", avg_stars: 4.5, rating_count: 2 }],
    );
    expect(out.map((v) => v.videoId)).toEqual(["a", "b", "d", "e"]);
    expect(out[1]).toMatchObject({ avgStars: 4.5, ratingCount: 2 });
  });
  it("includeHidden keeps hidden rows with status", () => {
    const out = mergeCards([row("c", 99)], [{ technique: "dink", video_id: "c", status: "hidden", pinned: false }], [], { includeHidden: true });
    expect(out[0]?.status).toBe("hidden");
  });
});

it("thumbnailUrl", () => {
  expect(thumbnailUrl("abc")).toBe("https://i.ytimg.com/vi/abc/hqdefault.jpg");
});
