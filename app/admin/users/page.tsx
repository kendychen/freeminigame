import { requireSiteAdmin } from "@/lib/auth";
import { UsersAdminClient } from "./UsersAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminUsers() {
  const { supabase } = await requireSiteAdmin();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, site_role, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const { data: bans } = await supabase
    .from("user_bans")
    .select("user_id, reason, banned_until");
  return (
    <UsersAdminClient
      initial={data ?? []}
      banMap={Object.fromEntries((bans ?? []).map((b) => [b.user_id, b]))}
    />
  );
}
