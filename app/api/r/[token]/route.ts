import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Thành viên của từng đội, dạng { teamId: ["Tên A", "Tên B"] }.
 *
 * Trọng tài cần biết ai đang đánh, không chỉ tên đội. Trước đây endpoint này
 * chỉ trả `teams`, nên mỗi lần poll 3s lại ghi đè danh sách đội mà không có
 * thành viên — tên người đánh chỉ có ở lần render đầu rồi đứng im.
 */
async function loadMembersByTeam(
  svc: ReturnType<typeof createServiceClient>,
  teamIds: string[],
): Promise<Record<string, string[]>> {
  if (teamIds.length === 0) return {};
  const { data } = await svc
    .from("team_members")
    .select("team_id, players(name)")
    .in("team_id", teamIds);
  type Row = {
    team_id: string;
    players: { name: string } | { name: string }[] | null;
  };
  const out: Record<string, string[]> = {};
  for (const r of (data ?? []) as Row[]) {
    const arr = out[r.team_id] ?? [];
    const p = Array.isArray(r.players) ? r.players[0] : r.players;
    if (p?.name) arr.push(p.name);
    out[r.team_id] = arr;
  }
  return out;
}

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

  // Try scoped token first (new path), fall back to legacy per-match column
  const { data: scoped } = await svc
    .from("referee_tokens")
    .select("token, tournament_id, scope, scope_value")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();

  if (scoped) {
    const { data: t } = await svc
      .from("tournaments")
      .select("id, slug, name, deleted_at")
      .eq("id", scoped.tournament_id)
      .maybeSingle();
    if (!t || t.deleted_at) {
      return NextResponse.json(
        { error: "tournament_not_found" },
        { status: 404 },
      );
    }

    let matchQuery = svc
      .from("matches")
      .select("*")
      .eq("tournament_id", scoped.tournament_id);
    if (scoped.scope === "group") {
      matchQuery = matchQuery.eq("group_label", scoped.scope_value);
    } else if (scoped.scope === "bracket") {
      matchQuery = matchQuery.eq("bracket", scoped.scope_value);
    } else {
      matchQuery = matchQuery.eq("id", scoped.scope_value);
    }
    const { data: matches } = await matchQuery
      .order("round")
      .order("match_number");

    const teamIds = Array.from(
      new Set(
        (matches ?? []).flatMap((m) =>
          [m.team_a_id, m.team_b_id].filter((x): x is string => !!x),
        ),
      ),
    );
    const { data: teams } = teamIds.length
      ? await svc
          .from("teams")
          .select("id, name, logo_url")
          .in("id", teamIds)
      : { data: [] };

    return NextResponse.json(
      {
        scope: scoped.scope,
        scopeValue: scoped.scope_value,
        matches: matches ?? [],
        teams: teams ?? [],
        membersByTeam: await loadMembersByTeam(svc, teamIds),
        tournament: { name: t.name, slug: t.slug },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  // Legacy: per-match referee_token column
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
    {
      scope: "match",
      match,
      teams: teams ?? [],
      membersByTeam: await loadMembersByTeam(svc, ids),
      tournament: { name: t.name, slug: t.slug },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
