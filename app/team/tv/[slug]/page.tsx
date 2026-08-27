import { notFound } from "next/navigation";
import { loadTeamTvState } from "@/app/actions/team";
import TeamTvClient from "./TeamTvClient";
import { getTvLayout } from "@/lib/tv-layout";

export const dynamic = "force-dynamic";

export default async function TeamTvPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ layout?: string | string[] }>;
}) {
  const [{ slug }, { layout: layoutParam }] = await Promise.all([params, searchParams]);
  const [initial, layout] = await Promise.all([loadTeamTvState(slug), getTvLayout(layoutParam)]);
  if (!initial) notFound();
  return <TeamTvClient initial={initial} layout={layout} />;
}
