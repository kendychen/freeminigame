import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadPicEventState } from "@/app/actions/pic";
import PicEventClient from "./PicEventClient";

export const dynamic = "force-dynamic";

export default async function PicEventPage({
  params,
}: {
  params: { slug: string };
}) {
  const { user } = await requireUser();
  const state = await loadPicEventState(params.slug);
  if (!state) redirect("/dashboard");
  if (state.ownerId !== user.id) redirect("/dashboard");
  return <PicEventClient state={state} />;
}
