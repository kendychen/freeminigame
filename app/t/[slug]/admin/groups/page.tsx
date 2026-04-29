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
  return (
    <GroupsClient tournamentId={t.id} tournamentName={t.name} initialTeams={teams ?? []} />
  );
}
