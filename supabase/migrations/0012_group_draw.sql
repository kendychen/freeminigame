-- 0012_group_draw.sql — group division for tournaments + linked pair lobby auto-apply

ALTER TABLE teams ADD COLUMN IF NOT EXISTS group_label TEXT;
CREATE INDEX IF NOT EXISTS idx_teams_group
  ON teams(tournament_id, group_label) WHERE group_label IS NOT NULL;

ALTER TABLE pair_sessions
  ADD COLUMN IF NOT EXISTS linked_tournament_id UUID
    REFERENCES tournaments(id) ON DELETE SET NULL;

ALTER TABLE pair_sessions
  ADD COLUMN IF NOT EXISTS team_id_map JSONB;

CREATE INDEX IF NOT EXISTS idx_pair_linked_tournament
  ON pair_sessions(linked_tournament_id);
