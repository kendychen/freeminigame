-- 0022_quick_scores.sql — anonymous shareable scoreboards
-- Anyone can create, read, and update by code. RLS allows public access
-- because the code itself is the auth (24-char unguessable). Auto-expires
-- in 30 days; cleaned by a cron-like sweep elsewhere.

CREATE TABLE IF NOT EXISTS quick_scores (
  code TEXT PRIMARY KEY,
  team_a_name TEXT NOT NULL CHECK (length(team_a_name) BETWEEN 1 AND 80),
  team_b_name TEXT NOT NULL CHECK (length(team_b_name) BETWEEN 1 AND 80),
  score_a INT NOT NULL DEFAULT 0 CHECK (score_a >= 0),
  score_b INT NOT NULL DEFAULT 0 CHECK (score_b >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','live','completed')),
  winner TEXT CHECK (winner IN ('a','b')),
  target_points INT,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_quick_scores_expires
  ON quick_scores(expires_at);

ALTER TABLE quick_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quick_scores_read_all ON quick_scores;
CREATE POLICY quick_scores_read_all
  ON quick_scores FOR SELECT
  USING (expires_at > NOW());

DROP POLICY IF EXISTS quick_scores_insert_all ON quick_scores;
CREATE POLICY quick_scores_insert_all
  ON quick_scores FOR INSERT
  WITH CHECK (
    length(team_a_name) BETWEEN 1 AND 80
    AND length(team_b_name) BETWEEN 1 AND 80
  );

DROP POLICY IF EXISTS quick_scores_update_all ON quick_scores;
CREATE POLICY quick_scores_update_all
  ON quick_scores FOR UPDATE
  USING (expires_at > NOW());

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_quick_scores_updated_at ON quick_scores;
CREATE TRIGGER trg_quick_scores_updated_at
  BEFORE UPDATE ON quick_scores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'quick_scores'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE quick_scores';
  END IF;
END $$;
