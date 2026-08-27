import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getTechnique, isTechniqueSlug, type TechniqueSlug } from "./techniques";
import { searchVideos, getVideoDetails } from "./youtube";
import { classifyCandidates } from "./classify";
import { filterCandidates, selectVideos } from "./select";
import { getSetting } from "@/lib/settings";
import { MARKETS, type Market } from "./market";

export type RefreshResult = {
  slug: string;
  skipped?: "locked" | "cooldown";
  kept?: number;
  gone?: number;
  error?: "no_candidates" | "no_videos_selected";
};

const LOCK_STALE_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 60 * 1000;
const DUE_MS = 6 * 24 * 60 * 60 * 1000;
// YouTube search.list costs 100 quota units (10k/day budget). Search results
// barely move week to week, so a failed Gemini pass must never re-spend them.
const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// A slug that just failed is not retried by the next batch; it waits its turn.
const ATTEMPT_BACKOFF_MS = 2 * 60 * 60 * 1000;

type SearchCache = Partial<Record<Market, { ids: string[]; at: string }>>;

function cachedRanked(cache: SearchCache, market: Market, now: number) {
  const entry = cache[market];
  if (!entry || now - new Date(entry.at).getTime() > SEARCH_TTL_MS) return null;
  return entry.ids.map((id, rank) => ({ id, rank }));
}

export async function refreshTechnique(slug: TechniqueSlug, opts: { force?: boolean } = {}): Promise<RefreshResult> {
  const svc = createServiceClient();
  const technique = getTechnique(slug);
  const now = Date.now();

  const { data: state, error: stateError } = await svc
    .from("technique_refresh_state").select("last_refreshed_at, locked_at, search_cache").eq("slug", slug).maybeSingle();
  if (stateError) throw new Error(`refresh_state_read_failed:${stateError.message}`);
  if (!state) throw new Error(`refresh_state_missing:${slug}`);
  const lockedAt = state.locked_at as string | null;
  const lastRefreshedAt = state.last_refreshed_at as string | null;
  const searchCache: SearchCache = { ...((state.search_cache as SearchCache | null) ?? {}) };
  if (lockedAt && now - new Date(lockedAt).getTime() < LOCK_STALE_MS) return { slug, skipped: "locked" };
  if (!opts.force && lastRefreshedAt && now - new Date(lastRefreshedAt).getTime() < COOLDOWN_MS) {
    return { slug, skipped: "cooldown" };
  }

  // Claim: single conditional update against the lock value we just read.
  // If locked_at was null, only succeeds when it's still null; if it held a
  // (stale, per the check above) timestamp, only succeeds when it still
  // matches that exact value. Either way a race loses the claim, not the data.
  let claimQuery = svc
    .from("technique_refresh_state")
    .update({ locked_at: new Date(now).toISOString(), last_attempted_at: new Date(now).toISOString() })
    .eq("slug", slug);
  claimQuery = lockedAt === null ? claimQuery.is("locked_at", null) : claimQuery.eq("locked_at", lockedAt);
  const claim = await claimQuery.select("slug");
  if (!claim.data?.length) return { slug, skipped: "locked" };

  try {
    const { data: pinnedRows, error: pinnedError } = await svc
      .from("technique_video_overrides").select("video_id").eq("technique", slug).eq("pinned", true);
    if (pinnedError) throw new Error(`pinned_read_failed:${pinnedError.message}`);
    const pinnedIds = (pinnedRows ?? []).map((r) => r.video_id as string);

    const [{ value: ytKey }, { value: geminiKey }] = await Promise.all([
      getSetting("youtube_api_key"), getSetting("gemini_api_key"),
    ]);
    // One search + classify pass per market. Markets run sequentially: the
    // cron already refreshes 3 slugs in parallel, and 6 concurrent Gemini
    // calls tripped the free-tier rate limit (http_429).
    const runMarket = async (market: Market) => {
      let ranked = cachedRanked(searchCache, market, now);
      if (!ranked) {
        ranked = await searchVideos(
          market === "vn" ? technique.queryVi : technique.query, fetch, ytKey, market === "vn" ? "vi" : "en",
        );
        searchCache[market] = { ids: ranked.map((r) => r.id), at: new Date().toISOString() };
      }
      // Pinned ids go first so getVideoDetails' 50-id cap truncates ranked
      // search results, never pinned videos.
      const ids = Array.from(new Set([...pinnedIds, ...ranked.map((r) => r.id)]));
      const submittedIds = new Set(ids.slice(0, 50));
      const details = await getVideoDetails(ids, fetch, ytKey);
      const candidates = filterCandidates(details, ranked);
      const cls = await classifyCandidates(technique, candidates.map((c) => ({
        id: c.id, title: c.title, channelTitle: c.channelTitle, durationSec: c.durationSec, description: c.description,
        viewCount: c.viewCount, likeCount: c.likeCount, commentCount: c.commentCount, publishedAt: c.publishedAt,
      })), fetch, geminiKey, market);
      const selected = selectVideos(slug, candidates, cls);
      return { market, submittedIds, details, candidates, selected };
    };
    const passes: Awaited<ReturnType<typeof runMarket>>[] = [];
    for (const market of MARKETS) passes.push(await runMarket(market));
    const submittedIds = new Set(passes.flatMap((p) => [...p.submittedIds]));
    const foundIds = new Set(passes.flatMap((p) => p.details.map((d) => d.id)));

    // Only mark a pinned id "gone" if it was actually submitted to the API
    // and still missing from the results — not merely truncated by the cap.
    const gone = pinnedIds.filter((id) => submittedIds.has(id) && !foundIds.has(id));
    if (gone.length) {
      const { error: goneError } = await svc.from("technique_video_overrides").upsert(
        gone.map((video_id) => ({ technique: slug, video_id, status: "gone", updated_at: new Date().toISOString() })),
        { onConflict: "technique,video_id" },
      );
      if (goneError) throw new Error(`gone_upsert_failed:${goneError.message}`);
    }

    // An empty selection is never "success": writing nothing while still
    // advancing last_refreshed_at and running the TTL delete would silently
    // empty a technique (e.g. Gemini schema drift drops every classification).
    // Release the lock, record why, and leave the existing rows untouched.
    // Per market: a market that selected nothing keeps its old rows; the
    // whole refresh only fails when every market came back empty.
    const kept = passes.filter((p) => p.selected.length > 0);
    if (kept.length === 0) {
      const reason = passes.every((p) => p.candidates.length === 0) ? "no_candidates" : "no_videos_selected";
      const { error: markError } = await svc.from("technique_refresh_state")
        .update({ locked_at: null, last_error: reason, search_cache: searchCache }).eq("slug", slug);
      if (markError) throw new Error(`empty_refresh_mark_failed:${markError.message}`);
      return { slug, error: reason, kept: 0, gone: gone.length };
    }

    const nowIso = new Date().toISOString();
    for (const pass of kept) {
      const { error } = await svc.from("technique_videos").upsert(
        pass.selected.map((v) => ({
          technique: slug, market: pass.market, video_id: v.videoId, title: v.title, channel_title: v.channelTitle,
          duration_sec: v.durationSec, view_count: v.viewCount, published_at: v.publishedAt, rank: v.rank,
          ai_score: v.aiScore, ai_level: v.aiLevel, ai_summary_vi: v.aiSummaryVi, last_seen_at: nowIso,
        })),
        { onConflict: "technique,market,video_id" },
      );
      if (error) throw new Error(`upsert_failed:${pass.market}:${error.message}`);
    }

    // A pinned video that still exists on YouTube but fell out of the search
    // top-N is not stale: keep its row fresh even though it never reached
    // `selected` (filterCandidates drops ids without a search rank).
    const pinnedFound = pinnedIds.filter((id) => foundIds.has(id));
    if (pinnedFound.length) {
      const { error: bumpError } = await svc.from("technique_videos")
        .update({ last_seen_at: nowIso }).eq("technique", slug).in("video_id", pinnedFound);
      if (bumpError) throw new Error(`pinned_bump_failed:${bumpError.message}`);
    }

    // Belt and braces: even a pinned id that YouTube no longer returns keeps
    // its row, so the override never points at a deleted card. Scoped to the
    // markets that actually refreshed so an empty pass never prunes its list.
    const staleBefore = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    for (const pass of kept) {
      let deleteQuery = svc.from("technique_videos").delete().eq("technique", slug).eq("market", pass.market)
        .lt("last_seen_at", staleBefore);
      if (pinnedIds.length) {
        deleteQuery = deleteQuery.not("video_id", "in", `(${pinnedIds.map((id) => `"${id}"`).join(",")})`);
      }
      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw new Error(`stale_delete_failed:${pass.market}:${deleteError.message}`);
    }

    const emptyMarkets = passes.filter((p) => p.selected.length === 0).map((p) => p.market);
    await svc.from("technique_refresh_state")
      .update({
        last_refreshed_at: new Date().toISOString(), locked_at: null, search_cache: searchCache,
        last_error: emptyMarkets.length ? `no_videos_selected:${emptyMarkets.join(",")}` : null,
      }).eq("slug", slug);
    return { slug, kept: kept.reduce((n, p) => n + p.selected.length, 0), gone: gone.length };
  } catch (e) {
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    await svc.from("technique_refresh_state")
      .update({ locked_at: null, last_error: message.slice(0, 500), search_cache: searchCache }).eq("slug", slug);
    throw e;
  }
}

export async function refreshDue(limit = 2): Promise<(RefreshResult | { slug: string; error: string })[]> {
  const svc = createServiceClient();
  const now = Date.now();
  const cutoff = new Date(now - DUE_MS).toISOString();
  const { data, error } = await svc
    .from("technique_refresh_state").select("slug, last_refreshed_at, last_attempted_at")
    .or(`last_refreshed_at.is.null,last_refreshed_at.lt.${cutoff}`)
    .order("last_refreshed_at", { ascending: true, nullsFirst: true });
  if (error) throw new Error(`refresh_due_query_failed:${error.message}`);
  const slugs = (data ?? [])
    .filter((r) => {
      const attempted = r.last_attempted_at as string | null;
      return !attempted || now - new Date(attempted).getTime() > ATTEMPT_BACKOFF_MS;
    })
    .map((r) => r.slug as string)
    .filter(isTechniqueSlug)
    .slice(0, limit);
  const settled = await Promise.allSettled(slugs.map((s) => refreshTechnique(s)));
  const results = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const slug = slugs[i] as string;
    const reason = r.reason as unknown;
    const error = reason instanceof Error ? reason.message : String(reason);
    return { slug, error };
  });
  if (settled.some((r) => r.status === "fulfilled")) {
    revalidatePath("/videos");
    revalidatePath("/videos/[technique]", "page");
  }
  return results;
}
