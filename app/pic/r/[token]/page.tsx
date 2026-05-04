import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { loadPicEventState } from "@/app/actions/pic";
import PicRefereeClient from "./PicRefereeClient";

export const dynamic = "force-dynamic";

export default async function PicRefereePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ g?: string }>;
}) {
  const { token } = await params;
  const { g } = await searchParams;

  const svc = createServiceClient();
  const { data: ev } = await svc
    .from("pic_events")
    .select("id")
    .eq("referee_token", token)
    .maybeSingle();

  if (!ev) notFound();

  const state = await loadPicEventState(ev.id);
  if (!state) notFound();

  return (
    <PicRefereeClient
      state={state}
      token={token}
      groupFilter={g ?? null}
    />
  );
}
