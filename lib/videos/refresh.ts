import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getTechnique, isTechniqueSlug, type TechniqueSlug } from "./techniques";
import { searchVideos, getVideoDetails } from "./youtube";
import { classifyCandidates } from "./classify";
import { filterCandidates, selectVideos } from "./select";

export type RefreshResult = { slug: string; skipped?: "locked" | "cooldown"; kept?: number; gone?: number };

const LOCK_STALE_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 60 * 1000;
const DUE_MS = 6 * 24 * 60 * 60 * 1000;

export async function refreshTechnique(slug: TechniqueSlug, opts: { force?: boolean } = {}): Promise<RefreshResult> {
  const svc = createServiceClient();
  const technique = getTechnique(slug);
  const now = Date.now();

  const { data: state } = await svc
    .from("technique_refresh_state").select("last_refreshed_at, locked_at").eq("slug", slug).maybeSingle();
  if (!state) throw new Error(`refresh_state_missing:${slug}`);
  const lockedAt = state.locked_at as string | null;
  const lastRefreshedAt = state.last_refreshed_at as string | null;
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
    .update({ locked_at: new Date(now).toISOString() })
    .eq("slug", slug);
  claimQuery = lockedAt === null ? claimQuery.is("locked_at", null) : claimQuery.eq("locked_at", lockedAt);
  const claim = await claimQuery.select("slug");
  if (!claim.data?.length) return { slug, skipped: "locked" };

  try {
    const { data: pinnedRows } = await svc
      .from("technique_video_overrides").select("video_id").eq("technique", slug).eq("pinned", true);
    const pinnedIds = (pinnedRows ?? []).map((r) => r.video_id as string);

    const ranked = await searchVideos(technique.query);
    const ids = Array.from(new Set([...ranked.map((r) => r.id), ...pinnedIds]));
    const details = await getVideoDetails(ids);
    const foundIds = new Set(details.map((d) => d.id));

    const gone = pinnedIds.filter((id) => !foundIds.has(id));
    if (gone.length) {
      await svc.from("technique_video_overrides").upsert(
        gone.map((video_id) => ({ technique: slug, video_id, status: "gone", updated_at: new Date().toISOString() })),
        { onConflict: "technique,video_id" },
      );
    }

    const candidates = filterCandidates(details, ranked);
    const cls = await classifyCandidates(technique, candidates.map((c) => ({
      id: c.id, title: c.title, channelTitle: c.channelTitle, durationSec: c.durationSec, description: c.description,
    })));
    const selected = selectVideos(slug, candidates, cls);

    if (selected.length) {
      const nowIso = new Date().toISOString();
      const { error } = await svc.from("technique_videos").upsert(
        selected.map((v) => ({
          technique: slug, video_id: v.videoId, title: v.title, channel_title: v.channelTitle,
          duration_sec: v.durationSec, view_count: v.viewCount, published_at: v.publishedAt, rank: v.rank,
          ai_score: v.aiScore, ai_level: v.aiLevel, ai_summary_vi: v.aiSummaryVi, last_seen_at: nowIso,
        })),
        { onConflict: "technique,video_id" },
      );
      if (error) throw new Error(`upsert_failed:${error.message}`);
    }

    await svc.from("technique_videos").delete().eq("technique", slug)
      .lt("last_seen_at", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString());

    await svc.from("technique_refresh_state")
      .update({ last_refreshed_at: new Date().toISOString(), locked_at: null, last_error: null }).eq("slug", slug);
    return { slug, kept: selected.length, gone: gone.length };
  } catch (e) {
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    await svc.from("technique_refresh_state").update({ locked_at: null, last_error: message.slice(0, 500) }).eq("slug", slug);
    throw e;
  }
}

export async function refreshDue(limit = 3): Promise<(RefreshResult | { slug: string; error: string })[]> {
  const svc = createServiceClient();
  const cutoff = new Date(Date.now() - DUE_MS).toISOString();
  const { data } = await svc
    .from("technique_refresh_state").select("slug, last_refreshed_at")
    .or(`last_refreshed_at.is.null,last_refreshed_at.lt.${cutoff}`)
    .order("last_refreshed_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  const slugs = (data ?? []).map((r) => r.slug as string).filter(isTechniqueSlug);
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
