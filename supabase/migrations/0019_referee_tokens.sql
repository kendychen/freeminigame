-- 0019_referee_tokens.sql — scoped referee tokens (per-group, future-proof per-bracket)
-- Replaces the per-match matches.referee_token column with a dedicated table
-- so a single referee can score every match in a group/bracket.

CREATE TABLE IF NOT EXISTS referee_tokens (
  token TEXT PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('group','bracket','match')),
  scope_value TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_referee_token_scope
  ON referee_tokens(tournament_id, scope, scope_value)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_referee_tokens_active
  ON referee_tokens(token) WHERE revoked_at IS NULL;
