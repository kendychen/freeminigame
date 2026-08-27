"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setVideoOverride, refreshTechniqueNow } from "@/app/actions/videos";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";
import { thumbnailUrl, type VideoCardData } from "@/lib/videos/queries";

export function AdminVideoTable({
  technique,
  cards,
}: {
  technique: string;
  cards: VideoCardData[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (
    fn: () => Promise<{ error?: string; kept?: number }>,
    okMsg: string,
  ) =>
    start(async () => {
      const r = await fn();
      if (r.error) {
        toast({
          title: "Lỗi",
          description: translateError(r.error),
          variant: "destructive",
        });
        // Surface the freshly written last_error on the page too.
        router.refresh();
      } else {
        toast({
          title: okMsg + (r.kept !== undefined ? ` (${r.kept} video)` : ""),
        });
        router.refresh();
      }
    });

  return (
    <div className="mt-4 space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => refreshTechniqueNow(technique), "Đã cập nhật")}
        className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        Refresh ngay
      </button>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th>Video</th>
              <th>AI</th>
              <th>★</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.videoId} className={c.status ? "opacity-60" : ""}>
                <td className="py-2">
                  <div className="flex gap-2">
                    <img
                      src={thumbnailUrl(c.videoId)}
                      alt=""
                      width={96}
                      height={54}
                      className="rounded object-cover"
                    />
                    <div>
                      <p className="line-clamp-1 font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.channelTitle}
                      </p>
                    </div>
                  </div>
                </td>
                <td>{c.aiScore}</td>
                <td>
                  {c.avgStars ?? "–"} ({c.ratingCount})
                </td>
                <td>
                  {c.status === "hidden" ? "ẩn" : c.status === "gone" ? "đã gỡ" : "hiện"}
                  {c.pinned ? " · ghim" : ""}
                </td>
                <td className="space-x-2 whitespace-nowrap">
                  <button
                    type="button"
                    disabled={pending}
                    className="text-primary"
                    onClick={() =>
                      run(
                        () =>
                          setVideoOverride(technique, c.videoId, {
                            pinned: !c.pinned,
                          }),
                        c.pinned ? "Đã bỏ ghim" : "Đã ghim",
                      )
                    }
                  >
                    {c.pinned ? "Bỏ ghim" : "Ghim"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="text-destructive"
                    onClick={() =>
                      run(
                        () =>
                          setVideoOverride(technique, c.videoId, {
                            status: c.status !== null ? null : "hidden",
                          }),
                        c.status !== null ? "Đã hiện lại" : "Đã ẩn",
                      )
                    }
                  >
                    {c.status !== null ? "Hiện" : "Ẩn"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
