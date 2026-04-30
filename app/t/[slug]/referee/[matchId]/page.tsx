import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { RefereeClient } from "./RefereeClient";

export default async function RefereePage({
  params,
}: {
  params: Promise<{ slug: string; matchId: string }>;
}) {
  const { slug, matchId } = await params;
  const { user, supabase } = await requireUser();

  const { data: t } = await supabase
    .from("tournaments")
    .select("id, slug, name, owner_id, deleted_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!t || t.deleted_at) notFound();

  const isOwner = t.owner_id === user.id;
  if (!isOwner) {
    const { data: ta } = await supabase
      .from("tournament_admins")
      .select("role")
      .eq("tournament_id", t.id)
      .eq("admin_id", user.id)
      .maybeSingle();
    const role = ta?.role as "owner" | "co_admin" | "viewer" | undefined;
    if (!role || role === "viewer") notFound();
  }

  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .eq("tournament_id", t.id)
    .maybeSingle();
  if (!match) notFound();

  const teamIds = [match.team_a_id, match.team_b_id].filter(
    (x): x is string => !!x,
  );
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, logo_url")
    .in(
      "id",
      teamIds.length > 0
        ? teamIds
        : ["00000000-0000-0000-0000-000000000000"],
    );

  return (
    <RefereeClient
      tournamentId={t.id}
      tournamentSlug={slug}
      tournamentName={t.name}
      initialMatch={match}
      teams={teams ?? []}
    />
  );
}
