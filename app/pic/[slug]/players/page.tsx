import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadPicEventState } from "@/app/actions/pic";
import { createServiceClient } from "@/lib/supabase/service";
import PicPlayersClient from "./PicPlayersClient";

export const dynamic = "force-dynamic";

export default async function PicPlayersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireUser();
  const state = await loadPicEventState(slug);
  if (!state || state.ownerId !== user.id) notFound();

  const hasCompletedMatches = state.groups.some(g =>
    g.matches.some(m => m.status === "completed"),
  );
  const hasMatches = state.groups.some(g => g.matches.length > 0);

  // Load active individual LIVE session if any
  const svc = createServiceClient();
  const { data: activeSession } = await svc
    .from("pic_individual_sessions")
    .select("code, player_tokens")
    .eq("event_id", state.id)
    .eq("status", "active")
    .maybeSingle();

  return (
    <PicPlayersClient
      eventId={state.id}
      initialPlayers={state.players}
      initialGroups={state.groups.map(g => ({ id: g.id, label: g.label, playerIds: g.playerIds }))}
      hasMatches={hasMatches}
      hasCompletedMatches={hasCompletedMatches}
      drawCode={state.config.drawCode ?? null}
      initialScheduleMode={state.config.scheduleMode ?? "standard"}
      initialLiveDraw={
        activeSession
          ? { code: activeSession.code as string, playerTokens: activeSession.player_tokens as Record<string, string> }
          : null
      }
    />
  );
}
