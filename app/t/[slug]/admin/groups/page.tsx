import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { GroupsClient } from "./GroupsClient";

export default async function GroupsPage({
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
    .select("id, name, group_label, region, rating, seed")
    .eq("tournament_id", t.id)
    .order("group_label", { ascending: true, nullsFirst: false })
    .order("seed", { ascending: true, nullsFirst: false });

  const teamIds = (teams ?? []).map((x) => x.id);
  const { data: memberRows } = teamIds.length
    ? await supabase
        .from("team_members")
        .select("team_id, players(id, name)")
        .in("team_id", teamIds)
    : { data: [] };
  type MemberRow = {
    team_id: string;
    players: { id: string; name: string } | { id: string; name: string }[] | null;
  };
  const membersByTeam: Record<string, { id: string; name: string }[]> = {};
  for (const r of (memberRows ?? []) as MemberRow[]) {
    const arr = membersByTeam[r.team_id] ?? [];
    const p = Array.isArray(r.players) ? r.players[0] : r.players;
    if (p) arr.push(p);
    membersByTeam[r.team_id] = arr;
  }

  // Has any bracket already been generated? (group + main + plate matches)
  const { count: matchCount } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", t.id);

  return (
    <GroupsClient
      tournamentId={t.id}
      tournamentName={t.name}
      initialTeams={teams ?? []}
      membersByTeam={membersByTeam}
      bracketAlreadyGenerated={(matchCount ?? 0) > 0}
    />
  );
}
