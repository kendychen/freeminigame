import { requireSiteAdmin } from "@/lib/auth";
import { TournamentsAdminClient } from "./TournamentsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminTournaments() {
  const { supabase } = await requireSiteAdmin();
  const { data } = await supabase
    .from("tournaments")
    .select("id, slug, name, status, format, owner_id, is_public, is_featured, deleted_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return <TournamentsAdminClient initial={data ?? []} />;
}
