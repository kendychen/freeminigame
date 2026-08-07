import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { loadTeamEventState } from "@/app/actions/team";
import TeamRefereeClient from "./TeamRefereeClient";

export const dynamic = "force-dynamic";

export default async function TeamRefereePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { token } = await params;
  const { t } = await searchParams;

  const svc = createServiceClient();
  const { data: ev } = await svc
    .from("team_events")
    .select("id")
    .eq("referee_token", token)
    .maybeSingle();

  if (!ev) notFound();

  const state = await loadTeamEventState(ev.id);
  if (!state) notFound();

  return <TeamRefereeClient state={state} token={token} tieFilter={t ?? null} />;
}
