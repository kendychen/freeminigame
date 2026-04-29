-- 0007_pair_sessions.sql — Live Pairing Lobby (Phase 9)
-- Anonymous realtime pairing sessions: host creates, participants join, host shuffles.

CREATE TABLE IF NOT EXISTS pair_sessions (
  code TEXT PRIMARY KEY,
  host_token TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Bốc thăm chia cặp',
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby','shuffled','locked')),
  group_size INT NOT NULL DEFAULT 2 CHECK (group_size BETWEEN 2 AND 20),
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  result JSONB,
  shuffle_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shuffled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '72 hours'),
  CHECK (expires_at <= NOW() + interval '7 days'),
  CHECK (jsonb_array_length(participants) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_pair_expires ON pair_sessions(expires_at);

ALTER TABLE pair_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public lobby link)
DROP POLICY IF EXISTS "pair_select" ON pair_sessions;
CREATE POLICY "pair_select" ON pair_sessions FOR SELECT USING (TRUE);

-- Inserts/updates only via service_role server actions (host_token validated in code).
-- No anon INSERT/UPDATE/DELETE policies → blocked at RLS layer.

-- Enable realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE pair_sessions;
