-- 0015_referee_token.sql — anonymous referee share-link tokens
-- Per-match opaque token. Anonymous score-increment uses service role
-- on server; token never exposed to client besides the share URL.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS referee_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_matches_referee_token
  ON matches(referee_token)
  WHERE referee_token IS NOT NULL;
