import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadTeamEventState } from "@/app/actions/team";
import TeamSettingsClient from "./TeamSettingsClient";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireUser();
  const state = await loadTeamEventState(slug);
  if (!state || state.event.owner_id !== user.id) notFound();
  return <TeamSettingsClient state={state} />;
}
