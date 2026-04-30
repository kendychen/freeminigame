import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { TeamsClient } from "./TeamsClient";

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { supabase } = await requireUser();
  const { data: t } = await supabase
    .from("tournaments")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) notFound();
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, region, rating, seed, logo_url")
    .eq("tournament_id", t.id)
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

  return (
    <TeamsClient
      tournamentId={t.id}
      initial={teams ?? []}
      membersByTeam={membersByTeam}
    />
  );
}
