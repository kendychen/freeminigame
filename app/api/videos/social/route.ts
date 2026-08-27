import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTechniqueSlug } from "@/lib/videos/techniques";

type ProfileEmbed = { display_name: string | null; avatar_url: string | null } | null;
type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: ProfileEmbed | ProfileEmbed[];
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = url.searchParams.get("t") ?? "";
  const v = url.searchParams.get("v") ?? "";
  if (!isTechniqueSlug(t) || !/^[\w-]{6,20}$/.test(v)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const [stats, mine, comments, profile] = await Promise.all([
    sb
      .from("technique_video_rating_stats")
      .select("avg_stars, rating_count")
      .eq("technique", t)
      .eq("video_id", v)
      .maybeSingle(),
    user
      ? sb
          .from("technique_video_ratings")
          .select("stars")
          .eq("technique", t)
          .eq("video_id", v)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sb
      .from("technique_video_comments")
      .select("id, body, created_at, user_id, profiles(display_name, avatar_url)")
      .eq("technique", t)
      .eq("video_id", v)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    user
      ? sb.from("profiles").select("site_role").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const dbError =
    stats.error?.message ??
    mine.error?.message ??
    comments.error?.message ??
    profile.error?.message;
  if (dbError) {
    return NextResponse.json({ error: dbError }, { status: 500 });
  }

  const siteRole = (profile.data as { site_role: string } | null)?.site_role ?? "";
  const isAdmin = ["moderator", "super_admin"].includes(siteRole);
  const rows = (comments.data ?? []) as unknown as CommentRow[];

  return NextResponse.json(
    {
      ratings: {
        avg: (stats.data as { avg_stars: number | null } | null)?.avg_stars ?? null,
        count: (stats.data as { rating_count: number } | null)?.rating_count ?? 0,
        mine: (mine.data as { stars: number } | null)?.stars ?? null,
      },
      comments: rows.map((c) => {
        const p = Array.isArray(c.profiles) ? (c.profiles[0] ?? null) : c.profiles;
        return {
          id: c.id,
          body: c.body,
          createdAt: c.created_at,
          user: {
            id: c.user_id,
            displayName: p?.display_name ?? "Người chơi",
            avatarUrl: p?.avatar_url ?? null,
          },
          canDelete: Boolean(user && (user.id === c.user_id || isAdmin)),
        };
      }),
      viewer: { loggedIn: Boolean(user) },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
