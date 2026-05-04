import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadPicEventState } from "@/app/actions/pic";
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

  return (
    <PicPlayersClient
      eventId={state.id}
      initialPlayers={state.players}
      hasGroups={state.groups.length > 0}
    />
  );
}
