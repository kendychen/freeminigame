-- 0013_team_draw.sql — random team formation from players (members)

-- pair_sessions: add player_id_map for team_draw mode
ALTER TABLE pair_sessions
  ADD COLUMN IF NOT EXISTS player_id_map JSONB;

-- pair_sessions: add team_name_pattern for auto-naming teams
ALTER TABLE pair_sessions
  ADD COLUMN IF NOT EXISTS team_name_pattern TEXT DEFAULT 'Đội {n}';
