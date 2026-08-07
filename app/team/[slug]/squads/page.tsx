import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadTeamEventState } from "@/app/actions/team";
import SquadsClient from "./SquadsClient";

export const dynamic = "force-dynamic";

export default async function TeamSquadsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireUser();
  const state = await loadTeamEventState(slug);
  if (!state || state.event.owner_id !== user.id) notFound();

  const lineupIds = new Set<string>();
  const genderLockedIds = new Set<string>();
  for (const r of state.rubbers) {
    for (const id of [r.a1_id, r.a2_id, r.b1_id, r.b2_id]) {
      if (!id) continue;
      lineupIds.add(id);
      if (r.category !== "FD") genderLockedIds.add(id);
    }
  }

  return (
    <SquadsClient
      eventId={state.event.id}
      slug={slug}
      stage={state.event.stage}
      config={state.event.config}
      initialSquads={state.squads.map(s => ({ id: s.id, name: s.name, groupLabel: s.group_label }))}
      initialPlayers={state.players.map(p => ({ id: p.id, name: p.name, gender: p.gender, squadId: p.squad_id }))}
      lineupPlayerIds={[...lineupIds]}
      genderLockedPlayerIds={[...genderLockedIds]}
    />
  );
}
