import { notFound } from "next/navigation";
import { loadTeamEventState } from "@/app/actions/team";
import TeamViewerClient from "./TeamViewerClient";

export const dynamic = "force-dynamic";

export default async function TeamViewerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const state = await loadTeamEventState(slug);
  if (!state) notFound();
  return <TeamViewerClient state={state} />;
}
