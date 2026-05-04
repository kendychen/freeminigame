import { notFound } from "next/navigation";
import { loadPicEventState } from "@/app/actions/pic";
import PicViewerClient from "./PicViewerClient";

export const dynamic = "force-dynamic";

export default async function PicViewerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const state = await loadPicEventState(slug);
  if (!state) notFound();
  return <PicViewerClient state={state} />;
}
