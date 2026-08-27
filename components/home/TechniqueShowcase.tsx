import Link from "next/link";
import { unstable_cache } from "next/cache";
import { ArrowRight, PlayCircle } from "lucide-react";
import { TECHNIQUES } from "@/lib/videos/techniques";
import { listOverview, thumbnailUrl, type VideoCardData } from "@/lib/videos/queries";

const FEATURED = 6;

// Local copies: the VideoCard versions live in a "use client" module.
const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const formatViews = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(n);

/** Best video per technique (VN first), top 6 by AI score. Cached 1h; empty on failure. */
const getFeatured = unstable_cache(
  async (): Promise<VideoCardData[]> => {
    try {
      const overview = await listOverview(1);
      return TECHNIQUES.map((t) => overview[t.slug]?.vn[0] ?? overview[t.slug]?.global[0])
        .filter((c): c is VideoCardData => Boolean(c))
        .sort((a, b) => b.aiScore - a.aiScore)
        .slice(0, FEATURED);
    } catch (e) {
      console.error("TechniqueShowcase: listOverview failed", e);
      return [];
    }
  },
  ["home-featured-videos"],
  { revalidate: 3600 },
);

const nameOf = new Map<string, string>(TECHNIQUES.map((t) => [t.slug, t.nameVi]));

export async function TechniqueShowcase({ containerClass = "max-w-7xl" }: { containerClass?: string }) {
  const cards = await getFeatured();
  return (
    <section id="ky-thuat" className={`mx-auto w-full ${containerClass} px-4 py-8 sm:py-10`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <PlayCircle className="size-3.5" /> Miễn phí · có tóm tắt tiếng Việt
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Hướng dẫn Kỹ thuật Pickleball</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Video chọn lọc theo 12 động tác — giao bóng, dink, third shot, volley… Lọc Việt Nam / thế giới, cơ bản / nâng cao.
          </p>
        </div>
        <Link
          href="/videos"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          Xem tất cả video <ArrowRight className="size-4" />
        </Link>
      </div>

      {cards.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={`${c.technique}-${c.videoId}`}
              href={`/videos/${c.technique}`}
              className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary"
            >
              <div className="relative aspect-video bg-muted">
                <img
                  src={thumbnailUrl(c.videoId)}
                  alt={c.title}
                  width={480}
                  height={270}
                  loading="lazy"
                  className="size-full object-cover"
                />
                <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {nameOf.get(c.technique) ?? c.technique}
                </span>
                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] text-white">
                  {formatDuration(c.durationSec)}
                </span>
              </div>
              <div className="space-y-1 p-3">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className={c.aiLevel === "advanced" ? "rounded bg-orange-500/15 px-1.5 text-orange-600" : "rounded bg-emerald-500/15 px-1.5 text-emerald-600"}>
                    {c.aiLevel === "advanced" ? "Nâng cao" : "Cơ bản"}
                  </span>
                  <span className="text-muted-foreground">{c.market === "vn" ? "Việt Nam" : "Thế giới"}</span>
                </div>
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{c.title}</p>
                <p className="text-[11px] text-muted-foreground">{c.channelTitle} · {formatViews(c.viewCount)} lượt xem</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {TECHNIQUES.map((t) => (
          <Link
            key={t.slug}
            href={`/videos/${t.slug}`}
            className="rounded-full border bg-card px-3 py-1.5 text-[13px] font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            {t.nameVi}
          </Link>
        ))}
      </div>
    </section>
  );
}
