"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rateVideo } from "@/app/actions/videos";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";

export function RatingStars({
  technique,
  videoId,
  avg,
  count,
  mine,
  loggedIn,
  onChanged,
}: {
  technique: string;
  videoId: string;
  avg: number | null;
  count: number;
  mine: number | null;
  loggedIn: boolean;
  onChanged: () => void;
}) {
  const [hover, setHover] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  const pick = (n: number) => {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/videos/${technique}`)}`);
      return;
    }
    start(async () => {
      const r = await rateVideo(technique, videoId, n);
      if (r.error) {
        toast({ title: "Lỗi", description: translateError(r.error), variant: "destructive" });
      } else {
        onChanged();
      }
    });
  };
  const shown = hover || mine || 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            aria-label={`${n} sao`}
            onMouseEnter={() => setHover(n)}
            onClick={() => pick(n)}
            className={n <= shown ? "text-yellow-500" : "text-muted-foreground"}
          >
            ★
          </button>
        ))}
      </div>
      <span className="text-muted-foreground">
        {avg !== null ? `${avg} (${count})` : "Chưa có đánh giá"}
      </span>
    </div>
  );
}
