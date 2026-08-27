"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { VideoCardData } from "@/lib/videos/queries";
import { RatingStars } from "./RatingStars";
import { CommentList, type CommentItem } from "./CommentList";

type Social = {
  ratings: { avg: number | null; count: number; mine: number | null };
  comments: CommentItem[];
  viewer: { loggedIn: boolean };
};

async function fetchSocial(card: VideoCardData | null) {
  if (!card) return null;
  const res = await fetch(`/api/videos/social?t=${card.technique}&v=${card.videoId}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return { key: `${card.technique}|${card.videoId}`, data: (await res.json()) as Social };
}

export function VideoDialog({
  card,
  onClose,
}: {
  card: VideoCardData | null;
  onClose: () => void;
}) {
  const cardKey = card ? `${card.technique}|${card.videoId}` : "";
  const [loaded, setLoaded] = useState<{ key: string; data: Social } | null>(null);
  // Key of the card currently open, so a late response for a previous card can be dropped.
  const openKey = useRef(cardKey);
  const load = useCallback(async () => {
    const data = await fetchSocial(card);
    if (data && data.key === openKey.current) setLoaded(data);
  }, [card]);
  useEffect(() => {
    openKey.current = card ? `${card.technique}|${card.videoId}` : "";
    let cancelled = false;
    void (async () => {
      const data = await fetchSocial(card);
      if (!cancelled && data && data.key === openKey.current) setLoaded(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [card]);
  // Ignore data belonging to a previously opened video instead of clearing state in the effect.
  const social = loaded && loaded.key === cardKey ? loaded.data : null;

  return (
    <Dialog
      open={card !== null}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      {card && (
        <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[88dvh] overflow-y-auto space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug">{card.title}</DialogTitle>
          </DialogHeader>
          <div className="aspect-[16/9] w-full overflow-hidden rounded-md bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${card.videoId}?autoplay=1&rel=0`}
              title={card.title}
              className="size-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="text-sm text-muted-foreground">{card.aiSummaryVi}</p>
          {social && (
            <>
              <RatingStars
                technique={card.technique}
                videoId={card.videoId}
                avg={social.ratings.avg}
                count={social.ratings.count}
                mine={social.ratings.mine}
                loggedIn={social.viewer.loggedIn}
                onChanged={load}
              />
              <CommentList
                technique={card.technique}
                videoId={card.videoId}
                comments={social.comments}
                loggedIn={social.viewer.loggedIn}
                onChanged={load}
              />
            </>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
