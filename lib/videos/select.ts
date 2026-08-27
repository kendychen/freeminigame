import type { YtVideo } from "./youtube";
import type { Classification } from "./classify";

export type SelectedVideo = {
  videoId: string; title: string; channelTitle: string; durationSec: number; viewCount: number;
  publishedAt: string; rank: number; aiScore: number; aiLevel: "basic" | "advanced"; aiSummaryVi: string;
};

export function filterCandidates(details: YtVideo[], ranked: { id: string; rank: number }[]) {
  const rankById = new Map(ranked.map((r) => [r.id, r.rank]));
  return details
    .filter((v) => rankById.has(v.id))
    .filter((v) => v.durationSec >= 60 && v.embeddable && !v.blockedRegions.includes("VN"))
    .map((v) => ({ ...v, rank: rankById.get(v.id)! }));
}

export function selectVideos(
  slug: string, candidates: (YtVideo & { rank: number })[], cls: Classification[], limit = 20,
): SelectedVideo[] {
  const byId = new Map(cls.map((c) => [c.id, c]));
  return candidates
    .flatMap((v) => {
      const c = byId.get(v.id);
      if (!c || !c.isTutorial || c.score < 60 || c.technique !== slug) return [];
      return [{
        videoId: v.id, title: v.title, channelTitle: v.channelTitle, durationSec: v.durationSec,
        viewCount: v.viewCount, publishedAt: v.publishedAt, rank: v.rank,
        aiScore: c.score, aiLevel: c.level, aiSummaryVi: c.summaryVi,
      }];
    })
    .sort((a, b) => b.aiScore - a.aiScore || a.rank - b.rank)
    .slice(0, limit);
}
