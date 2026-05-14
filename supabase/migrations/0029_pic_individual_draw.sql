-- 0029_pic_individual_draw.sql — PIC individual self-draw LIVE session
-- Realtime multi-device draw: admin creates session, players tap their own name
-- (via personal token) or anyone with code link can tap (open mode).

CREATE TABLE IF NOT EXISTS pic_individual_sessions (
  code TEXT PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES pic_events(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  host_token TEXT NOT NULL,
  group_sizes JSONB NOT NULL,           -- e.g. [8, 8]
  player_tokens JSONB NOT NULL,         -- { playerId: token }
  assignments JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { playerId: groupIdx }
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'applied', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_pic_indiv_event ON pic_individual_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_pic_indiv_expires ON pic_individual_sessions(expires_at);

ALTER TABLE pic_individual_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pic_indiv_select" ON pic_individual_sessions;
CREATE POLICY "pic_indiv_select" ON pic_individual_sessions FOR SELECT USING (TRUE);

-- All writes via service_role server actions (host_token / player_token validated in code).

ALTER PUBLICATION supabase_realtime ADD TABLE pic_individual_sessions;
