import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { QuickScoreClient } from "./QuickScoreClient";

export const dynamic = "force-dynamic";

export default async function QuickScorePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!code || code.length < 4 || !/^[A-Za-z0-9]+$/.test(code)) {
    notFound();
  }
  const svc = createServiceClient();
  const { data } = await svc
    .from("quick_scores")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (!data) notFound();
  if (new Date(data.expires_at).getTime() < Date.now()) notFound();
  return <QuickScoreClient initial={data} />;
}
