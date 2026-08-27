"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { VideoCardData } from "@/lib/videos/queries";
import {
  MARKETS, MARKET_LABEL, LEVELS, LEVEL_LABEL, DEFAULT_MARKET,
  parseMarket, parseLevel, type Market, type LevelFilter,
} from "@/lib/videos/market";

export type MarketCards = Record<Market, VideoCardData[]>;

// URL is the source of truth: ?m=global&lv=basic. Defaults (vn / all) are
// omitted from the URL so the canonical page URL stays clean.
export function useVideoFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const market = parseMarket(params.get("m"));
  const level = parseLevel(params.get("lv"));

  const set = useCallback(
    (next: { market?: Market; level?: LevelFilter }) => {
      const m = next.market ?? market;
      const lv = next.level ?? level;
      const q = new URLSearchParams();
      if (m !== DEFAULT_MARKET) q.set("m", m);
      if (lv !== "all") q.set("lv", lv);
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [market, level, pathname, router],
  );

  return { market, level, set };
}

export function applyFilters(byMarket: MarketCards, market: Market, level: LevelFilter, limit?: number) {
  const cards = byMarket[market].filter((c) => level === "all" || c.aiLevel === level);
  return limit === undefined ? cards : cards.slice(0, limit);
}

const pill = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`;

export function VideoFilterBar({
  market, level, onChange,
}: {
  market: Market; level: LevelFilter; onChange: (next: { market?: Market; level?: LevelFilter }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Video</span>
        {MARKETS.map((m) => (
          <button key={m} type="button" aria-pressed={market === m} className={pill(market === m)} onClick={() => onChange({ market: m })}>
            {MARKET_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trình độ</span>
        {LEVELS.map((lv) => (
          <button key={lv} type="button" aria-pressed={level === lv} className={pill(level === lv)} onClick={() => onChange({ level: lv })}>
            {LEVEL_LABEL[lv]}
          </button>
        ))}
      </div>
    </div>
  );
}
