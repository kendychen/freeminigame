import { parseIsoDuration } from "./duration";

const BASE = "https://www.googleapis.com/youtube/v3";

export type YtVideo = {
  id: string; title: string; description: string; channelTitle: string;
  publishedAt: string; durationSec: number; viewCount: number; likeCount: number; commentCount: number;
  embeddable: boolean; blockedRegions: string[];
};

export class YoutubeError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = "YoutubeError";
  }
}

function apiKey(override?: string): string {
  const k = override || process.env.YOUTUBE_API_KEY;
  if (!k) throw new YoutubeError("missing_api_key");
  return k;
}

async function ytGet(path: string, params: Record<string, string>, fetchImpl: typeof fetch, key?: string) {
  const qs = new URLSearchParams({ ...params, key: apiKey(key) });
  const res = await fetchImpl(`${BASE}/${path}?${qs}`);
  const body = (await res.json().catch(() => ({}))) as {
    items?: unknown[]; error?: { errors?: { reason?: string }[]; message?: string };
  };
  if (!res.ok) {
    const reason = body.error?.errors?.[0]?.reason ?? `http_${res.status}`;
    throw new YoutubeError(reason, body.error?.message);
  }
  return body.items ?? [];
}

export async function searchVideos(
  query: string, fetchImpl: typeof fetch = fetch, key?: string, lang: "en" | "vi" = "en",
) {
  const items = (await ytGet("search", {
    part: "id", type: "video", q: query, regionCode: "VN", relevanceLanguage: lang,
    publishedAfter: "2021-01-01T00:00:00Z", videoEmbeddable: "true",
    maxResults: "30", order: "relevance",
  }, fetchImpl, key)) as { id?: { videoId?: string } }[];
  return items
    .map((it) => it.id?.videoId)
    .filter((id): id is string => Boolean(id))
    .map((id, rank) => ({ id, rank }));
}

export function mapVideoItem(raw: unknown): YtVideo | null {
  const it = raw as {
    id?: string;
    snippet?: { title?: string; description?: string; channelTitle?: string; publishedAt?: string };
    contentDetails?: { duration?: string; regionRestriction?: { blocked?: string[] } };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
    status?: { embeddable?: boolean };
  };
  if (!it.id || !it.snippet?.title) return null;
  return {
    id: it.id,
    title: it.snippet.title,
    description: it.snippet.description ?? "",
    channelTitle: it.snippet.channelTitle ?? "",
    publishedAt: it.snippet.publishedAt ?? "1970-01-01T00:00:00Z",
    durationSec: parseIsoDuration(it.contentDetails?.duration ?? ""),
    viewCount: Number(it.statistics?.viewCount ?? 0),
    likeCount: Number(it.statistics?.likeCount ?? 0),
    commentCount: Number(it.statistics?.commentCount ?? 0),
    embeddable: it.status?.embeddable !== false,
    blockedRegions: it.contentDetails?.regionRestriction?.blocked ?? [],
  };
}

export async function getVideoDetails(ids: string[], fetchImpl: typeof fetch = fetch, key?: string) {
  if (ids.length === 0) return [];
  const items = await ytGet("videos", {
    part: "snippet,contentDetails,statistics,status",
    id: ids.slice(0, 50).join(","),
  }, fetchImpl, key);
  return items.map(mapVideoItem).filter((v): v is YtVideo => v !== null);
}

/** Cheapest authenticated call (1 quota unit). Throws YoutubeError on bad key. */
export async function pingYoutube(key: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  await ytGet("videos", { part: "id", id: "dQw4w9WgXcQ" }, fetchImpl, key);
}
