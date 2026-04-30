import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public polling endpoint for the anonymous referee page.
 * Returns the current match state plus team names. No auth required.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 16 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  const svc = createServiceClient();
  const { data: match } = await svc
    .from("matches")
    .select("*")
    .eq("referee_token", token)
    .maybeSingle();
  if (!match) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }
  const { data: t } = await svc
    .from("tournaments")
    .select("id, slug, name, deleted_at")
    .eq("id", match.tournament_id)
    .maybeSingle();
  if (!t || t.deleted_at) {
    return NextResponse.json({ error: "tournament_not_found" }, { status: 404 });
  }
  const ids = [match.team_a_id, match.team_b_id].filter(
    (x): x is string => !!x,
  );
  const { data: teams } = await svc
    .from("teams")
    .select("id, name, logo_url")
    .in(
      "id",
      ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"],
    );
  return NextResponse.json(
    { match, teams: teams ?? [], tournament: { name: t.name, slug: t.slug } },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
