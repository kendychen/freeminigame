import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { BracketAdminClient } from "./BracketAdminClient";

export default async function AdminBracketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { supabase } = await requireUser();
  const { data: t } = await supabase
    .from("tournaments")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) notFound();
  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("tournament_id", t.id);
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", t.id);

  const teamIds = (teams ?? []).map((x) => x.id);
  const { data: memberRows } = teamIds.length
    ? await supabase
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
    <BracketAdminClient
      tournament={t}
      teams={teams ?? []}
      initialMatches={matches ?? []}
      membersByTeam={membersByTeam}
    />
  );
}
