export const MARKETS = ["vn", "global"] as const;
export type Market = (typeof MARKETS)[number];
export const DEFAULT_MARKET: Market = "vn";
export const MARKET_LABEL: Record<Market, string> = { vn: "Việt Nam", global: "Toàn thế giới" };

export function parseMarket(v: string | null | undefined): Market {
  return v === "global" ? "global" : DEFAULT_MARKET;
}

export const LEVELS = ["all", "basic", "advanced"] as const;
export type LevelFilter = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<LevelFilter, string> = {
  all: "Tất cả",
  basic: "Cơ bản · mới tập",
  advanced: "Nâng cao · chơi lâu",
};

export function parseLevel(v: string | null | undefined): LevelFilter {
  return v === "basic" || v === "advanced" ? v : "all";
}
