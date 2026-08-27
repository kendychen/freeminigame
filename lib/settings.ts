// Server-only: reads secrets via the service client. Never import at runtime from client components (type imports are fine).
import { createServiceClient } from "@/lib/supabase/service";

export const SETTING_KEYS = ["youtube_api_key", "gemini_api_key", "cron_secret"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

const ENV_FALLBACK: Record<SettingKey, string> = {
  youtube_api_key: "YOUTUBE_API_KEY",
  gemini_api_key: "GEMINI_API_KEY",
  cron_secret: "CRON_SECRET",
};

export function isSettingKey(k: string): k is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(k);
}

export type SettingStatus = { key: SettingKey; source: "db" | "env" | "none"; masked: string | null };

export function maskSecret(v: string): string {
  if (v.length <= 4) return "••••";
  return `••••${v.slice(-4)}`;
}

/** DB value first, env fallback. DB read errors are logged and fall through to env. */
export async function getSetting(key: SettingKey): Promise<{ value: string | undefined; source: SettingStatus["source"] }> {
  const { data, error } = await createServiceClient()
    .from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) console.error(`[settings] read ${key} failed: ${error.message}`);
  const dbValue = (data?.value as string | undefined) || undefined;
  if (dbValue) return { value: dbValue, source: "db" };
  const envValue = process.env[ENV_FALLBACK[key]] || undefined;
  return { value: envValue, source: envValue ? "env" : "none" };
}

export async function getSettingStatuses(): Promise<SettingStatus[]> {
  return Promise.all(
    SETTING_KEYS.map(async (key) => {
      const { value, source } = await getSetting(key);
      return { key, source, masked: value ? maskSecret(value) : null };
    }),
  );
}
