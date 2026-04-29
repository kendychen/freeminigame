import { requireSiteAdmin } from "@/lib/auth";
import { QuickBracketsAdminClient } from "./QuickBracketsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminQuickBrackets() {
  const { supabase } = await requireSiteAdmin();
  const { data } = await supabase
    .from("quick_brackets")
    .select("code, format, team_count, view_count, created_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return <QuickBracketsAdminClient initial={data ?? []} />;
}
