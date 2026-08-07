import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import TournamentDrawClient from "./TournamentDrawClient";

export const dynamic = "force-dynamic";

export default async function TournamentDrawPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { code } = await params;
  const { p: entrantToken } = await searchParams;
  const svc = createServiceClient();

  const { data: session } = await svc
    .from("t_draw_sessions")
    .select(
      "code, tournament_id, owner_id, mode, slot_sizes, slot_tags, entrant_tokens, assignments, status",
    )
    .eq("code", code)
    .single();
  if (!session) notFound();

  const { data: tournament } = await svc
    .from("tournaments")
    .select("name")
    .eq("id", session.tournament_id)
    .single();
  if (!tournament) notFound();

  let entrants: { id: string; name: string }[] = [];
  if (session.mode === "pair") {
    const { data } = await svc
      .from("players")
      .select("id, name, seed_tag")
      .eq("tournament_id", session.tournament_id)
      .order("created_at");
    entrants = (data ?? []).map((p) => ({
      id: p.id,
      name: p.seed_tag ? `${p.name} (${p.seed_tag})` : p.name,
    }));
  } else {
    const { data } = await svc
      .from("teams")
      .select("id, name")
      .eq("tournament_id", session.tournament_id)
      .order("created_at");
    entrants = (data ?? []).map((t) => ({ id: t.id, name: t.name }));
  }
  // Only entrants that are part of the session (snapshot at creation time)
  const tokens = session.entrant_tokens as Record<string, string>;
  entrants = entrants.filter((e) => e.id in tokens);

  // Resolve entrantToken → entrantId (URL never carries the raw id)
  let lockedEntrantId: string | null = null;
  if (entrantToken) {
    for (const [id, t] of Object.entries(tokens)) {
      if (t === entrantToken) {
        lockedEntrantId = id;
        break;
      }
    }
  }

  return (
    <TournamentDrawClient
      code={code}
      tournamentName={tournament.name}
      ownerId={session.owner_id as string}
      mode={session.mode as "group" | "slot" | "pair"}
      entrants={entrants}
      slotSizes={session.slot_sizes as number[]}
      slotTags={(session.slot_tags as Record<string, string> | null) ?? null}
      initialAssignments={
        session.assignments as Record<string, { g: number; p: number }>
      }
      initialStatus={session.status as string}
      lockedEntrantId={lockedEntrantId}
      entrantToken={entrantToken ?? null}
    />
  );
}
