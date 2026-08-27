-- 0037_app_settings.sql — Admin-editable secrets (API keys, cron secret).
-- RLS enabled with NO policies → service role only. Idempotent.

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY CHECK (key IN ('youtube_api_key','gemini_api_key','cron_secret')),
  value      TEXT NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
