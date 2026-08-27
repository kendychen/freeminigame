import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { TECHNIQUES } from "./techniques";

export type VideoRow = {
  technique: string; video_id: string; title: string; channel_title: string; duration_sec: number;
  view_count: number; published_at: string; rank: number; ai_score: number; ai_level: string;
  ai_summary_vi: string; last_seen_at: string; created_at: string;
};
export type OverrideRow = { technique: string; video_id: string; status: "hidden" | "gone" | null; pinned: boolean };
export type StatsRow = { technique: string; video_id: string; avg_stars: number | null; rating_count: number };

export type VideoCardData = {
  technique: string; videoId: string; title: string; channelTitle: string; durationSec: number;
  viewCount: number; aiScore: number; aiLevel: "basic" | "advanced"; aiSummaryVi: string;
  pinned: boolean; status: "hidden" | "gone" | null; avgStars: number | null; ratingCount: number;
};

export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

const key = (t: string, v: string) => `${t}|${v}`;

export function mergeCards(
  videos: VideoRow[], overrides: OverrideRow[], stats: StatsRow[], opts: { includeHidden?: boolean } = {},
): VideoCardData[] {
  const ov = new Map(overrides.map((o) => [key(o.technique, o.video_id), o]));
  const st = new Map(stats.map((s) => [key(s.technique, s.video_id), s]));
  return videos
    .map((v) => {
      const o = ov.get(key(v.technique, v.video_id));
      const s = st.get(key(v.technique, v.video_id));
      return {
        technique: v.technique, videoId: v.video_id, title: v.title, channelTitle: v.channel_title,
        durationSec: v.duration_sec, viewCount: v.view_count, aiScore: v.ai_score,
        aiLevel: v.ai_level === "advanced" ? "advanced" as const : "basic" as const,
        aiSummaryVi: v.ai_summary_vi, pinned: o?.pinned ?? false, status: o?.status ?? null,
        avgStars: s?.avg_stars ?? null, ratingCount: s?.rating_count ?? 0,
      };
    })
    .filter((c) => opts.includeHidden || c.status === null)
    .sort((a, b) =>
      Number(b.pinned) - Number(a.pinned) || b.aiScore - a.aiScore || b.viewCount - a.viewCount || a.videoId.localeCompare(b.videoId),
    );
}

function anonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !k) throw new Error("Supabase env vars missing");
  return createClient(url, k, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadTechnique(sb: SupabaseClient, slug: string) {
  const [v, o, s] = await Promise.all([
    sb.from("technique_videos").select("*").eq("technique", slug),
    sb.from("technique_video_overrides").select("technique, video_id, status, pinned").eq("technique", slug),
    sb.from("technique_video_rating_stats").select("technique, video_id, avg_stars, rating_count").eq("technique", slug),
  ]);
  if (v.error) throw new Error(`loadTechnique: technique_videos query failed: ${v.error.message}`);
  if (o.error) throw new Error(`loadTechnique: technique_video_overrides query failed: ${o.error.message}`);
  if (s.error) throw new Error(`loadTechnique: technique_video_rating_stats query failed: ${s.error.message}`);
  return { videos: (v.data ?? []) as VideoRow[], overrides: (o.data ?? []) as OverrideRow[], stats: (s.data ?? []) as StatsRow[] };
}

export async function listTechniqueVideos(slug: string, limit = 20): Promise<VideoCardData[]> {
  const { videos, overrides, stats } = await loadTechnique(anonClient(), slug);
  return mergeCards(videos, overrides, stats).slice(0, limit);
}

export async function listOverview(perTechnique = 4): Promise<Record<string, VideoCardData[]>> {
  const sb = anonClient();
  const [v, o, s] = await Promise.all([
    sb.from("technique_videos").select("*"),
    sb.from("technique_video_overrides").select("technique, video_id, status, pinned"),
    sb.from("technique_video_rating_stats").select("technique, video_id, avg_stars, rating_count"),
  ]);
  if (v.error) throw new Error(`listOverview: technique_videos query failed: ${v.error.message}`);
  if (o.error) throw new Error(`listOverview: technique_video_overrides query failed: ${o.error.message}`);
  if (s.error) throw new Error(`listOverview: technique_video_rating_stats query failed: ${s.error.message}`);
  const all = mergeCards((v.data ?? []) as VideoRow[], (o.data ?? []) as OverrideRow[], (s.data ?? []) as StatsRow[]);
  const out: Record<string, VideoCardData[]> = {};
  for (const t of TECHNIQUES) out[t.slug] = all.filter((c) => c.technique === t.slug).slice(0, perTechnique);
  return out;
}

export async function listTechniqueVideosAdmin(slug: string): Promise<VideoCardData[]> {
  const { videos, overrides, stats } = await loadTechnique(createServiceClient(), slug);
  return mergeCards(videos, overrides, stats, { includeHidden: true });
}
