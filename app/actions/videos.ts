"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireSiteAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { isTechniqueSlug } from "@/lib/videos/techniques";
import { normalizeComment, isRateLimited } from "@/lib/videos/comment-rules";
import { refreshTechnique } from "@/lib/videos/refresh";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dbError(where: string, message: string): { error: string } {
  console.error(`[videos] ${where}: ${message}`);
  return { error: "db_error" };
}

type ExistsResult = { ok: true; exists: boolean } | { ok: false; error: string };

async function videoExists(technique: string, videoId: string): Promise<ExistsResult> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("technique_videos")
    .select("video_id")
    .eq("technique", technique)
    .eq("video_id", videoId)
    .maybeSingle();
  if (error) return { ok: false, ...dbError("videoExists", error.message) };
  return { ok: true, exists: Boolean(data) };
}

export async function rateVideo(
  technique: string,
  videoId: string,
  stars: number,
): Promise<{ error?: string }> {
  const { user } = await requireUser();
  if (!isTechniqueSlug(technique)) return { error: "video_not_found" };
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { error: "invalid_rating" };
  const exists = await videoExists(technique, videoId);
  if (!exists.ok) return { error: exists.error };
  if (!exists.exists) return { error: "video_not_found" };
  const { error } = await createServiceClient()
    .from("technique_video_ratings")
    .upsert(
      {
        technique,
        video_id: videoId,
        user_id: user.id,
        stars,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "technique,video_id,user_id" },
    );
  return error ? dbError("rateVideo.upsert", error.message) : {};
}

export async function postComment(
  technique: string,
  videoId: string,
  body: string,
): Promise<{ error?: string }> {
  const { user } = await requireUser();
  if (!isTechniqueSlug(technique)) return { error: "video_not_found" };
  const n = normalizeComment(body);
  if (!n.ok) return { error: n.error };
  const exists = await videoExists(technique, videoId);
  if (!exists.ok) return { error: exists.error };
  if (!exists.exists) return { error: "video_not_found" };
  const svc = createServiceClient();
  const { data: recent, error: recentError } = await svc
    .from("technique_video_comments")
    .select("created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);
  if (recentError) return dbError("postComment.recent", recentError.message);
  if (isRateLimited((recent ?? []).map((r) => r.created_at as string), Date.now())) {
    return { error: "comment_rate_limited" };
  }
  const { error } = await svc
    .from("technique_video_comments")
    .insert({ technique, video_id: videoId, user_id: user.id, body: n.body });
  return error ? dbError("postComment.insert", error.message) : {};
}

export async function deleteComment(id: string): Promise<{ error?: string }> {
  const { user, supabase } = await requireUser();
  if (!UUID_RE.test(id)) return { error: "not_found" };
  const svc = createServiceClient();
  const { data: c, error: findError } = await svc
    .from("technique_video_comments")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (findError) return dbError("deleteComment.find", findError.message);
  if (!c) return { error: "not_found" };
  if (c.user_id !== user.id) {
    const { data: p, error: profileError } = await supabase
      .from("profiles")
      .select("site_role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) return dbError("deleteComment.profile", profileError.message);
    if (!p || !["moderator", "super_admin"].includes(p.site_role as string)) {
      return { error: "forbidden" };
    }
  }
  const { error } = await svc
    .from("technique_video_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  return error ? dbError("deleteComment.update", error.message) : {};
}

export async function setVideoOverride(
  technique: string,
  videoId: string,
  patch: { status?: "hidden" | null; pinned?: boolean },
): Promise<{ error?: string }> {
  const { user } = await requireSiteAdmin();
  if (!isTechniqueSlug(technique)) return { error: "video_not_found" };
  const svc = createServiceClient();
  const { data: cur, error: curError } = await svc
    .from("technique_video_overrides")
    .select("status, pinned")
    .eq("technique", technique)
    .eq("video_id", videoId)
    .maybeSingle();
  if (curError) return dbError("setVideoOverride.current", curError.message);
  const { error } = await svc.from("technique_video_overrides").upsert(
    {
      technique,
      video_id: videoId,
      status: patch.status !== undefined ? patch.status : ((cur?.status as string | null) ?? null),
      pinned: patch.pinned !== undefined ? patch.pinned : ((cur?.pinned as boolean) ?? false),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "technique,video_id" },
  );
  if (error) return dbError("setVideoOverride.upsert", error.message);
  revalidatePath("/videos");
  revalidatePath(`/videos/${technique}`);
  return {};
}

export async function refreshTechniqueNow(
  technique: string,
): Promise<{ error?: string; kept?: number }> {
  await requireSiteAdmin();
  if (!isTechniqueSlug(technique)) return { error: "video_not_found" };
  try {
    const r = await refreshTechnique(technique);
    if (r.skipped === "locked") return { error: "refresh_locked" };
    if (r.skipped === "cooldown") return { error: "refresh_cooldown" };
    revalidatePath("/videos");
    revalidatePath(`/videos/${technique}`);
    return { kept: r.kept };
  } catch {
    return { error: "refresh_failed" };
  }
}
