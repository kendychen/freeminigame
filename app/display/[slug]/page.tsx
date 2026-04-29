import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LiveTournamentView } from "../../t/[slug]/LiveTournamentView";

export const revalidate = 10;

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tournaments")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
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
    <div className="flex h-screen w-screen flex-col bg-background p-8 text-foreground">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-bold">{t.name}</h1>
        <span className="rounded-full border bg-secondary px-4 py-2 text-lg">
          {String(t.format).replace("_", " ")} · {t.status}
        </span>
      </div>
      <div className="flex-1 overflow-auto text-2xl">
        <LiveTournamentView
          tournament={t}
          teams={teams ?? []}
          initialMatches={matches ?? []}
        />
      </div>
    </div>
  );
}
