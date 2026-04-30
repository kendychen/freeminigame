import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { PublicRefereeClient } from "./PublicRefereeClient";
import { PublicGroupRefereeClient } from "./PublicGroupRefereeClient";

export const dynamic = "force-dynamic";

export default async function PublicRefereePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 16 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    notFound();
  }
  const svc = createServiceClient();

  // Scoped token first
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
    if (!t || t.deleted_at) notFound();

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
    const { data: memberRows } = teamIds.length
      ? await svc
          .from("team_members")
          .select("team_id, players(name)")
          .in("team_id", teamIds)
      : { data: [] };
    type MR = {
      team_id: string;
      players: { name: string } | { name: string }[] | null;
    };
    const membersByTeam: Record<string, string[]> = {};
    for (const r of (memberRows ?? []) as MR[]) {
      const arr = membersByTeam[r.team_id] ?? [];
      const p = Array.isArray(r.players) ? r.players[0] : r.players;
      if (p?.name) arr.push(p.name);
      membersByTeam[r.team_id] = arr;
    }

    return (
      <PublicGroupRefereeClient
        token={token}
        scope={scoped.scope as "group" | "bracket" | "match"}
        scopeValue={scoped.scope_value}
        tournamentName={t.name}
        initialMatches={matches ?? []}
        teams={teams ?? []}
        membersByTeam={membersByTeam}
      />
    );
  }

  // Legacy: per-match referee_token column
  const { data: match } = await svc
    .from("matches")
    .select("*")
    .eq("referee_token", token)
    .maybeSingle();
  if (!match) notFound();

  const { data: t } = await svc
    .from("tournaments")
    .select("id, slug, name, deleted_at")
    .eq("id", match.tournament_id)
    .maybeSingle();
  if (!t || t.deleted_at) notFound();

  const teamIds = [match.team_a_id, match.team_b_id].filter(
    (x): x is string => !!x,
  );
  const { data: teams } = await svc
    .from("teams")
    .select("id, name, logo_url")
    .in(
      "id",
      teamIds.length > 0
        ? teamIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  const { data: legacyMemberRows } = teamIds.length
    ? await svc
        .from("team_members")
        .select("team_id, players(name)")
        .in("team_id", teamIds)
    : { data: [] };
  type MR2 = {
    team_id: string;
    players: { name: string } | { name: string }[] | null;
  };
  const legacyMembers: Record<string, string[]> = {};
  for (const r of (legacyMemberRows ?? []) as MR2[]) {
    const arr = legacyMembers[r.team_id] ?? [];
    const p = Array.isArray(r.players) ? r.players[0] : r.players;
    if (p?.name) arr.push(p.name);
    legacyMembers[r.team_id] = arr;
  }

  return (
    <PublicRefereeClient
      token={token}
      tournamentName={t.name}
      initialMatch={match}
      teams={teams ?? []}
      membersByTeam={legacyMembers}
    />
  );
}
