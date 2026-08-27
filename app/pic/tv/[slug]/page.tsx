import { notFound } from "next/navigation";
import { loadPicTvState } from "@/app/actions/pic";
import PicTvClient from "./PicTvClient";

export const dynamic = "force-dynamic";

export default async function PicTvPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const initial = await loadPicTvState(slug);
  if (!initial) notFound();
  return <PicTvClient initial={initial} />;
}
