import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import PicLiveDrawClient from "./PicLiveDrawClient";

export const dynamic = "force-dynamic";

export default async function PicLiveDrawPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { code } = await params;
  const { p: playerToken } = await searchParams;
  const svc = createServiceClient();

  const { data: session } = await svc
    .from("pic_individual_sessions")
    .select("code, event_id, owner_id, group_sizes, player_tokens, assignments, status")
    .eq("code", code)
    .single();
  if (!session) notFound();

  const { data: ev } = await svc
    .from("pic_events")
    .select("config, slug")
    .eq("id", session.event_id)
    .single();
  if (!ev) notFound();

  const { data: players } = await svc
    .from("pic_players")
    .select("id, name")
    .eq("event_id", session.event_id);

  // Resolve playerToken → playerId (so URL doesn't leak playerId)
  let lockedPlayerId: string | null = null;
  if (playerToken) {
    const tokens = session.player_tokens as Record<string, string>;
    for (const [pid, t] of Object.entries(tokens)) {
      if (t === playerToken) { lockedPlayerId = pid; break; }
    }
  }

  const cfg = ev.config as { name?: string };
  const eventName = cfg?.name ?? "PIC tournament";

  return (
    <PicLiveDrawClient
      code={code}
      eventName={eventName}
      ownerId={session.owner_id as string}
      players={(players ?? []).map((p) => ({ id: p.id, name: p.name }))}
      groupSizes={session.group_sizes as number[]}
      initialAssignments={session.assignments as Record<string, number>}
      initialStatus={session.status as string}
      lockedPlayerId={lockedPlayerId}
      playerToken={playerToken ?? null}
    />
  );
}
