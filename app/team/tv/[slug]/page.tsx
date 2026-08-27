import { notFound } from "next/navigation";
import { loadTeamTvState } from "@/app/actions/team";
import TeamTvClient from "./TeamTvClient";

export const dynamic = "force-dynamic";

export default async function TeamTvPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const initial = await loadTeamTvState(slug);
  if (!initial) notFound();
  return <TeamTvClient initial={initial} />;
}
