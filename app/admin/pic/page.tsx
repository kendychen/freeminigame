import { requireSiteAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import PicAdminClient from "./PicAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPicPage() {
  await requireSiteAdmin();
  const svc = createServiceClient();

  const { data: events } = await svc
    .from("pic_events")
    .select("id, slug, config, stage, owner_id, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(300);

  // Count players per event
  const ids = (events ?? []).map((e) => e.id);
  const { data: playerCounts } = ids.length > 0
    ? await svc.from("pic_players").select("event_id").in("event_id", ids)
    : { data: [] };

  const countMap: Record<string, number> = {};
  for (const p of playerCounts ?? []) {
    countMap[p.event_id] = (countMap[p.event_id] ?? 0) + 1;
  }

  const rows = (events ?? []).map((e) => ({
    id: e.id as string,
    slug: e.slug as string,
    name: (e.config as { name?: string })?.name ?? e.slug,
    stage: e.stage as string,
    owner_id: e.owner_id as string,
    playerCount: countMap[e.id] ?? 0,
    created_at: e.created_at as string,
  }));

  return <PicAdminClient initial={rows} />;
}
