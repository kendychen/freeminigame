import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";

export type SiteStats = { users: number; tournaments: number };

const TOURNAMENT_TABLES = ["tournaments", "pair_sessions", "pic_events"] as const;

async function count(table: string): Promise<number> {
  const { count, error } = await createServiceClient()
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error(`site-stats: count ${table} failed`, error.message);
    return 0;
  }
  return count ?? 0;
}

/** Public counters for the homepage. Cached 10 minutes; zeros on failure. */
export const getSiteStats = unstable_cache(
  async (): Promise<SiteStats> => {
    const [users, ...events] = await Promise.all([
      count("profiles"),
      ...TOURNAMENT_TABLES.map(count),
    ]);
    return { users, tournaments: events.reduce((a, b) => a + b, 0) };
  },
  ["site-stats"],
  { revalidate: 600 },
);

export function formatCount(n: number): string {
  return n.toLocaleString("vi-VN");
}
