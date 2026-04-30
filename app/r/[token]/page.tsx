import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { PublicRefereeClient } from "./PublicRefereeClient";

export const dynamic = "force-dynamic";

export default async function PublicRefereePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 16 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    notFound();
  }
  const svc = createServiceClient();
  const { data: match } = await svc
    .from("matches")
    .select("*")
    .eq("referee_token", token)
    .maybeSingle();
  if (!match) notFound();

  const { data: t } = await svc
    .from("tournaments")
    .select("id, slug, name, deleted_at")
    .eq("id", match.tournament_id)
    .maybeSingle();
  if (!t || t.deleted_at) notFound();

  const teamIds = [match.team_a_id, match.team_b_id].filter(
    (x): x is string => !!x,
  );
  const { data: teams } = await svc
    .from("teams")
    .select("id, name, logo_url")
    .in(
      "id",
      teamIds.length > 0
        ? teamIds
        : ["00000000-0000-0000-0000-000000000000"],
    );

  return (
    <PublicRefereeClient
      token={token}
      tournamentName={t.name}
      initialMatch={match}
      teams={teams ?? []}
    />
  );
}
