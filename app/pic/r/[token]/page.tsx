import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { loadPicEventState } from "@/app/actions/pic";
import PicRefereeClient from "./PicRefereeClient";

export const dynamic = "force-dynamic";

export default async function PicRefereePage({
  params,
}: {
  params: { token: string };
}) {
  const svc = createServiceClient();
  const { data: ev } = await svc
    .from("pic_events")
    .select("id")
    .eq("referee_token", params.token)
    .maybeSingle();

  if (!ev) notFound();

  const state = await loadPicEventState(ev.id);
  if (!state) notFound();

  return <PicRefereeClient state={state} token={params.token} />;
}
