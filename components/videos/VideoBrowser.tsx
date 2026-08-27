"use client";
import Link from "next/link";
import { VideoGrid } from "./VideoGrid";
import { VideoFilterBar, applyFilters, useVideoFilters, type MarketCards } from "./VideoFilters";

const Empty = () => <p className="text-sm text-muted-foreground">Chưa có video phù hợp — thử đổi bộ lọc.</p>;

export function TechniqueBrowser({ byMarket }: { byMarket: MarketCards }) {
  const { market, level, set } = useVideoFilters();
  const cards = applyFilters(byMarket, market, level);
  return (
    <>
      <VideoFilterBar market={market} level={level} onChange={set} />
      <div className="mt-6">{cards.length ? <VideoGrid cards={cards} /> : <Empty />}</div>
    </>
  );
}

export type OverviewSection = { slug: string; nameVi: string; nameEn: string; byMarket: MarketCards };

export function OverviewBrowser({ sections, perTechnique }: { sections: OverviewSection[]; perTechnique: number }) {
  const { market, level, set } = useVideoFilters();
  const query = new URLSearchParams();
  if (market !== "vn") query.set("m", market);
  if (level !== "all") query.set("lv", level);
  const suffix = query.toString() ? `?${query}` : "";
  return (
    <>
      <VideoFilterBar market={market} level={level} onChange={set} />
      {sections.map((s) => {
        const cards = applyFilters(s.byMarket, market, level, perTechnique);
        return (
          <section key={s.slug} className="mt-8">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold sm:text-xl">
                {s.nameVi} <span className="text-sm font-normal text-muted-foreground">{s.nameEn}</span>
              </h2>
              <Link href={`/videos/${s.slug}${suffix}`} className="shrink-0 text-sm text-primary">Xem tất cả →</Link>
            </div>
            {cards.length ? <VideoGrid cards={cards} /> : <Empty />}
          </section>
        );
      })}
    </>
  );
}
