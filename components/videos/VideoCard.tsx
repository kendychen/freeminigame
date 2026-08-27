"use client";
import { Pin } from "lucide-react";
import { thumbnailUrl, type VideoCardData } from "@/lib/videos/queries";

export function formatDuration(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function VideoCard({ card, onOpen }: { card: VideoCardData; onOpen: (c: VideoCardData) => void }) {
  return (
    <button type="button" onClick={() => onOpen(card)} className="group text-left rounded-xl border bg-card overflow-hidden hover:shadow-md transition">
      <div className="relative aspect-[16/9] bg-muted">
        <img src={thumbnailUrl(card.videoId)} alt={card.title} width={480} height={270} loading="lazy" className="size-full object-cover" />
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] text-white">{formatDuration(card.durationSec)}</span>
        {card.pinned && <Pin className="absolute left-1.5 top-1.5 size-4 text-primary" />}
      </div>
      <div className="p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-[11px]">
          <span className={card.aiLevel === "advanced" ? "rounded bg-orange-500/15 px-1.5 text-orange-600" : "rounded bg-emerald-500/15 px-1.5 text-emerald-600"}>
            {card.aiLevel === "advanced" ? "Nâng cao" : "Cơ bản"}
          </span>
          {card.avgStars !== null && <span>★ {card.avgStars} ({card.ratingCount})</span>}
        </div>
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{card.title}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{card.aiSummaryVi}</p>
        <p className="text-[11px] text-muted-foreground">{card.channelTitle} · {formatViews(card.viewCount)} lượt xem</p>
      </div>
    </button>
  );
}
