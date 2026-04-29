import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LiveTournamentView } from "../../t/[slug]/LiveTournamentView";

export const revalidate = 30;

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tournaments")
    .select("*, tournament_embed_config(allowed_origins, is_enabled)")
    .eq("slug", slug)
    .is("deleted_at", null)
    .eq("is_public", true)
    .maybeSingle();
  if (!t) notFound();

  const cfg = (t as { tournament_embed_config?: { is_enabled: boolean } }).tournament_embed_config;
  if (cfg && cfg.is_enabled === false) notFound();

  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("tournament_id", t.id);
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", t.id);

  return (
    <div className="min-h-screen bg-transparent p-2">
      <LiveTournamentView
        tournament={t}
        teams={teams ?? []}
        initialMatches={matches ?? []}
      />
    </div>
  );
}
