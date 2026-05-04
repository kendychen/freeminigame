import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadPicEventState } from "@/app/actions/pic";
import PicSettingsClient from "./PicSettingsClient";

export const dynamic = "force-dynamic";

export default async function PicSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireUser();
  const state = await loadPicEventState(slug);
  if (!state || state.ownerId !== user.id) notFound();
  return <PicSettingsClient state={state} />;
}
