-- 0001_init_schema.sql — core schema for FreeMinigame
-- Creates: profiles, tournaments, tournament_admins, teams, team_members,
--          players, matches, match_sets, audit_logs, quick_brackets

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- profiles ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  site_role TEXT NOT NULL DEFAULT 'user'
    CHECK (site_role IN ('user','moderator','super_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_site_role
  ON profiles(site_role) WHERE site_role <> 'user';

-- tournaments -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN
    ('single_elim','double_elim','round_robin','swiss','group_knockout')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','running','completed','archived')),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournaments_owner ON tournaments(owner_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_public
  ON tournaments(is_public) WHERE is_public AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tournaments_active
  ON tournaments(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tournaments_featured
  ON tournaments(is_featured) WHERE is_featured AND deleted_at IS NULL;

-- tournament_admins -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tournament_admins (
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','co_admin','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tournament_id, admin_id)
);
CREATE INDEX IF NOT EXISTS idx_tournament_admins_user
  ON tournament_admins(admin_id);

-- global_teams (cross-tournament identity, populated in Phase 7) -------
CREATE TABLE IF NOT EXISTS global_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- teams -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  global_team_id UUID REFERENCES global_teams(id),
  name TEXT NOT NULL,
  logo_url TEXT,
  region TEXT,
  rating INT,
  seed INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teams_tournament ON teams(tournament_id);

-- players + members -----------------------------------------------------
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  handle TEXT,
  avatar_url TEXT,
  rating INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_players_tournament ON players(tournament_id);

CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role TEXT,
  PRIMARY KEY (team_id, player_id)
);

-- matches ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL,
  match_number INT NOT NULL,
  bracket TEXT NOT NULL DEFAULT 'main'
    CHECK (bracket IN ('main','winners','losers','grand_final','group')),
  group_label TEXT,
  team_a_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  team_b_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  score_a INT NOT NULL DEFAULT 0,
  score_b INT NOT NULL DEFAULT 0,
  winner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','live','completed','bye')),
  series_format TEXT NOT NULL DEFAULT 'bo1'
    CHECK (series_format IN ('bo1','bo3','bo5')),
  next_win_match_id UUID,
  next_loss_match_id UUID,
  scheduled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  CONSTRAINT matches_unique_slot UNIQUE
    (tournament_id, bracket, group_label, round, match_number)
);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_round
  ON matches(tournament_id, round);
CREATE INDEX IF NOT EXISTS idx_matches_next_win
  ON matches(next_win_match_id) WHERE next_win_match_id IS NOT NULL;

-- match_sets (BO3/BO5) --------------------------------------------------
CREATE TABLE IF NOT EXISTS match_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  set_number INT NOT NULL,
  score_a INT NOT NULL DEFAULT 0,
  score_b INT NOT NULL DEFAULT 0,
  winner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  UNIQUE (match_id, set_number)
);

-- audit_logs ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_record
  ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- quick_brackets (Quick Mode ephemeral share) ---------------------------
CREATE TABLE IF NOT EXISTS quick_brackets (
  code TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  format TEXT NOT NULL,
  team_count INT NOT NULL CHECK (team_count >= 2 AND team_count <= 64),
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quick_expires ON quick_brackets(expires_at);

-- user_bans + site_settings (Phase 8) -----------------------------------
CREATE TABLE IF NOT EXISTS user_bans (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  banned_until TIMESTAMPTZ,
  banned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO site_settings(key, value) VALUES
  ('maintenance_mode', '{"enabled":false,"message":""}'::jsonb),
  ('health_snapshot', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- avoid_pairs (Phase 7 advanced Swiss) ---------------------------------
CREATE TABLE IF NOT EXISTS avoid_pairs (
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_a_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team_b_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  reason TEXT,
  PRIMARY KEY (tournament_id, team_a_id, team_b_id),
  CHECK (team_a_id < team_b_id)
);

-- tournament_embed_config (Phase 7) -----------------------------------
CREATE TABLE IF NOT EXISTS tournament_embed_config (
  tournament_id UUID PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
  allowed_origins TEXT[] NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE
);

-- short_urls (Phase 7) -------------------------------------------------
CREATE TABLE IF NOT EXISTS short_urls (
  code TEXT PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at trigger ----------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tournaments_updated_at ON tournaments;
CREATE TRIGGER trg_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_matches_updated_at ON matches;
CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
