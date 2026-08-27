// Server-only: site-wide UI version switch, stored in site_settings.ui_theme.
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/service";

export const UI_THEMES = ["v1", "v2"] as const;
export type UiTheme = (typeof UI_THEMES)[number];
export const DEFAULT_UI_THEME: UiTheme = "v1";

export function parseUiTheme(v: unknown): UiTheme {
  const t = typeof v === "object" && v !== null ? (v as { theme?: unknown }).theme : v;
  return t === "v2" ? "v2" : DEFAULT_UI_THEME;
}

/** One DB read per request; on any error fall back to v1 so the site never breaks over a theme flag. */
export const getUiTheme = cache(async (): Promise<UiTheme> => {
  try {
    const { data, error } = await createServiceClient()
      .from("site_settings").select("value").eq("key", "ui_theme").maybeSingle();
    if (error) {
      console.error(`[ui-theme] read failed: ${error.message}`);
      return DEFAULT_UI_THEME;
    }
    return parseUiTheme(data?.value);
  } catch (e) {
    console.error(`[ui-theme] read threw: ${(e as Error).message}`);
    return DEFAULT_UI_THEME;
  }
});
