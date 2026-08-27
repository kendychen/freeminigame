import { notFound } from "next/navigation";
import { loadPicTvState } from "@/app/actions/pic";
import PicTvClient from "./PicTvClient";
import { getTvLayout } from "@/lib/tv-layout";

export const dynamic = "force-dynamic";

export default async function PicTvPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ layout?: string | string[] }>;
}) {
  const [{ slug }, { layout: layoutParam }] = await Promise.all([params, searchParams]);
  const [initial, layout] = await Promise.all([loadPicTvState(slug), getTvLayout(layoutParam)]);
  if (!initial) notFound();
  return <PicTvClient initial={initial} layout={layout} />;
}
