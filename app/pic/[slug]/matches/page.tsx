import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadPicEventState } from "@/app/actions/pic";
import PicEventClient from "../PicEventClient";

export const dynamic = "force-dynamic";

export default async function PicMatchesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireUser();
  const state = await loadPicEventState(slug);
  if (!state || state.ownerId !== user.id) notFound();
  return <PicEventClient state={state} />;
}
