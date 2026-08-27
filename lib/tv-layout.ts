// Server-only: site-wide TV display layout, stored in site_settings.tv_layout.
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/service";

export const TV_LAYOUTS = ["rotate", "split"] as const;
export type TvLayout = (typeof TV_LAYOUTS)[number];
export const DEFAULT_TV_LAYOUT: TvLayout = "rotate";

export function parseTvLayout(v: unknown): TvLayout {
  const t = typeof v === "object" && v !== null ? (v as { layout?: unknown }).layout : v;
  return t === "split" ? "split" : DEFAULT_TV_LAYOUT;
}

/** Site setting, overridable per TV with `?layout=split|rotate`. Falls back to rotate on any error. */
export const getTvLayout = cache(async (override?: string | string[]): Promise<TvLayout> => {
  const o = Array.isArray(override) ? override[0] : override;
  if (o === "split" || o === "rotate") return o;
  try {
    const { data, error } = await createServiceClient()
      .from("site_settings").select("value").eq("key", "tv_layout").maybeSingle();
    if (error) {
      console.error(`[tv-layout] read failed: ${error.message}`);
      return DEFAULT_TV_LAYOUT;
    }
    return parseTvLayout(data?.value);
  } catch (e) {
    console.error(`[tv-layout] read threw: ${(e as Error).message}`);
    return DEFAULT_TV_LAYOUT;
  }
});
