-- 0032_team_events.sql — Team mode (Giải đồng đội) — standalone event tables
-- team_events → team_squads → team_players + team_ties → team_rubbers.
-- Additive only. RLS mirrors 0026_pic_events.sql: public SELECT, owner ALL,
-- referee writes go through service role. Fully idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS team_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  stage TEXT NOT NULL DEFAULT 'setup'
    CHECK (stage IN ('setup','group','knockout','done')),  -- 'knockout' reserved for Phase 3
  referee_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES team_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  group_label TEXT,                      -- 'A','B',... NULL until schedule generated
  seed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES team_events(id) ON DELETE CASCADE,
  squad_id UUID REFERENCES team_squads(id) ON DELETE SET NULL,  -- NULL = unassigned pool
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  gender TEXT NOT NULL CHECK (gender IN ('M','F')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_ties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES team_events(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'group'
    CHECK (stage IN ('group','r16','quarterfinal','semifinal','final','third')), -- KO values reserved
  group_label TEXT,
  round INT NOT NULL DEFAULT 1,
  tie_no INT NOT NULL,                   -- event-wide display order; every query ORDER BY tie_no
  squad_a_id UUID REFERENCES team_squads(id) ON DELETE SET NULL, -- SET NULL: keep history (/t precedent)
  squad_b_id UUID REFERENCES team_squads(id) ON DELETE SET NULL,
  rubbers_won_a INT NOT NULL DEFAULT 0,   -- denormalized, server-side RECOUNT on every rubber change
  rubbers_won_b INT NOT NULL DEFAULT 0,
  winner_squad_id UUID REFERENCES team_squads(id) ON DELETE SET NULL, -- ties never draw; set by recount or setTieWinner
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, tie_no)               -- + blocks double-generate at the DB layer
);

CREATE TABLE IF NOT EXISTS team_rubbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tie_id UUID NOT NULL REFERENCES team_ties(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES team_events(id) ON DELETE CASCADE, -- denorm: RLS/realtime 1-hop
  rubber_no INT NOT NULL,                -- 1-based, order = index in config.rubbers
  category TEXT NOT NULL CHECK (category IN ('MD','WD','XD','FD')),
  a1_id UUID REFERENCES team_players(id) ON DELETE SET NULL,  -- lineup; NULL = not assigned yet
  a2_id UUID REFERENCES team_players(id) ON DELETE SET NULL,
  b1_id UUID REFERENCES team_players(id) ON DELETE SET NULL,
  b2_id UUID REFERENCES team_players(id) ON DELETE SET NULL,
  score_a INT NOT NULL DEFAULT 0,
  score_b INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','walkover')),
  walkover_winner TEXT CHECK (walkover_winner IN ('a','b')),  -- NULL when walkover = canceled rubber
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tie_id, rubber_no)
);

CREATE INDEX IF NOT EXISTS idx_team_squads_event  ON team_squads(event_id);
CREATE INDEX IF NOT EXISTS idx_team_players_event ON team_players(event_id);
CREATE INDEX IF NOT EXISTS idx_team_ties_event    ON team_ties(event_id);
CREATE INDEX IF NOT EXISTS idx_team_rubbers_tie   ON team_rubbers(tie_id);
CREATE INDEX IF NOT EXISTS idx_team_rubbers_event ON team_rubbers(event_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE team_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_squads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_ties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_rubbers ENABLE ROW LEVEL SECURITY;

-- Public read
DROP POLICY IF EXISTS "team_events_select" ON team_events;
CREATE POLICY "team_events_select"  ON team_events  FOR SELECT USING (true);

DROP POLICY IF EXISTS "team_squads_select" ON team_squads;
CREATE POLICY "team_squads_select"  ON team_squads  FOR SELECT USING (true);

DROP POLICY IF EXISTS "team_players_select" ON team_players;
CREATE POLICY "team_players_select" ON team_players FOR SELECT USING (true);

DROP POLICY IF EXISTS "team_ties_select" ON team_ties;
CREATE POLICY "team_ties_select"    ON team_ties    FOR SELECT USING (true);

DROP POLICY IF EXISTS "team_rubbers_select" ON team_rubbers;
CREATE POLICY "team_rubbers_select" ON team_rubbers FOR SELECT USING (true);

-- Owner write (service role bypasses RLS for referee paths)
DROP POLICY IF EXISTS "team_events_owner" ON team_events;
CREATE POLICY "team_events_owner"  ON team_events
  FOR ALL USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "team_squads_owner" ON team_squads;
CREATE POLICY "team_squads_owner"  ON team_squads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM team_events WHERE id = event_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "team_players_owner" ON team_players;
CREATE POLICY "team_players_owner" ON team_players
  FOR ALL USING (
    EXISTS (SELECT 1 FROM team_events WHERE id = event_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "team_ties_owner" ON team_ties;
CREATE POLICY "team_ties_owner"    ON team_ties
  FOR ALL USING (
    EXISTS (SELECT 1 FROM team_events WHERE id = event_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "team_rubbers_owner" ON team_rubbers;
CREATE POLICY "team_rubbers_owner" ON team_rubbers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM team_events WHERE id = event_id AND owner_id = auth.uid())
  );

-- ── updated_at triggers ────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_team_events_updated_at ON team_events;
CREATE TRIGGER trg_team_events_updated_at
  BEFORE UPDATE ON team_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_team_ties_updated_at ON team_ties;
CREATE TRIGGER trg_team_ties_updated_at
  BEFORE UPDATE ON team_ties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_team_rubbers_updated_at ON team_rubbers;
CREATE TRIGGER trg_team_rubbers_updated_at
  BEFORE UPDATE ON team_rubbers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Realtime (live viewer: filter event_id=eq.<id>) ────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_rubbers'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE team_rubbers';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_ties'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE team_ties';
  END IF;
END $$;
