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
  return (
    <BracketAdminClient
      tournament={t}
      teams={teams ?? []}
      initialMatches={matches ?? []}
    />
  );
}
