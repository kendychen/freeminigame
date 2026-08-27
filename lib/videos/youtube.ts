import { parseIsoDuration } from "./duration";

const BASE = "https://www.googleapis.com/youtube/v3";

export type YtVideo = {
  id: string; title: string; description: string; channelTitle: string;
  publishedAt: string; durationSec: number; viewCount: number;
  embeddable: boolean; blockedRegions: string[];
};

export class YoutubeError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = "YoutubeError";
  }
}

function apiKey(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new YoutubeError("missing_api_key");
  return k;
}

async function ytGet(path: string, params: Record<string, string>, fetchImpl: typeof fetch) {
  const qs = new URLSearchParams({ ...params, key: apiKey() });
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

export async function searchVideos(query: string, fetchImpl: typeof fetch = fetch) {
  const items = (await ytGet("search", {
    part: "id", type: "video", q: query, regionCode: "VN", relevanceLanguage: "en",
    publishedAfter: "2021-01-01T00:00:00Z", videoEmbeddable: "true",
    maxResults: "30", order: "relevance",
  }, fetchImpl)) as { id?: { videoId?: string } }[];
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
    statistics?: { viewCount?: string };
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
    embeddable: it.status?.embeddable !== false,
    blockedRegions: it.contentDetails?.regionRestriction?.blocked ?? [],
  };
}

export async function getVideoDetails(ids: string[], fetchImpl: typeof fetch = fetch) {
  if (ids.length === 0) return [];
  const items = await ytGet("videos", {
    part: "snippet,contentDetails,statistics,status",
    id: ids.slice(0, 50).join(","),
  }, fetchImpl);
  return items.map(mapVideoItem).filter((v): v is YtVideo => v !== null);
}
