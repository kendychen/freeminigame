"use client";
import { useState } from "react";
import type { VideoCardData } from "@/lib/videos/queries";
import { VideoCard } from "./VideoCard";
import { VideoDialog } from "./VideoDialog";

export function VideoGrid({ cards }: { cards: VideoCardData[] }) {
  const [open, setOpen] = useState<VideoCardData | null>(null);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => <VideoCard key={c.videoId} card={c} onOpen={setOpen} />)}
      </div>
      <VideoDialog card={open} onClose={() => setOpen(null)} />
    </>
  );
}
