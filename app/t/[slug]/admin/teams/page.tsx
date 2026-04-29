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
  return <TeamsClient tournamentId={t.id} initial={teams ?? []} />;
}
