import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { MembersClient } from "./MembersClient";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { supabase } = await requireUser();
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) notFound();
  const { data: players } = await supabase
    .from("players")
    .select("id, name, handle, rating, seed_tag, created_at")
    .eq("tournament_id", t.id)
    .order("created_at");
  const { data: teamCount } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", t.id);
  return (
    <MembersClient
      tournamentId={t.id}
      tournamentName={t.name}
      initialPlayers={players ?? []}
      hasTeams={(teamCount as unknown as { count?: number })?.count
        ? true
        : false}
    />
  );
}
