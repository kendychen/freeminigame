-- 0039_refresh_search_cache.sql — cache YouTube search ids per technique so a
-- failed Gemini pass never re-spends search quota; track attempts for backoff.
ALTER TABLE technique_refresh_state
  ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS search_cache JSONB;
