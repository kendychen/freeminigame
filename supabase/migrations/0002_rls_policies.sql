-- 0002_rls_policies.sql — full RLS for all tables
-- Roles concept: site_role (super_admin/moderator/user), tournament role (owner/co_admin/viewer)

-- Helper functions ------------------------------------------------------
CREATE OR REPLACE FUNCTION is_site_admin() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (SELECT 1 FROM profiles
    WHERE id = auth.uid() AND site_role IN ('moderator','super_admin'));
$$;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (SELECT 1 FROM profiles
    WHERE id = auth.uid() AND site_role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION is_tournament_admin(t_id UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM tournaments WHERE id = t_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM tournament_admins
      WHERE tournament_id = t_id AND admin_id = auth.uid()
      AND role IN ('owner','co_admin'))
  );
$$;

CREATE OR REPLACE FUNCTION can_view_tournament(t_id UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = t_id
    AND t.deleted_at IS NULL
    AND (
      t.is_public
      OR auth.uid() = t.owner_id
      OR EXISTS (SELECT 1 FROM tournament_admins ta
        WHERE ta.tournament_id = t.id AND ta.admin_id = auth.uid())
    )
  ) OR is_site_admin();
$$;

-- profiles --------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR is_site_admin());
DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND site_role = (SELECT site_role FROM profiles WHERE id = auth.uid()));

-- tournaments -----------------------------------------------------------
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tournaments_select" ON tournaments;
CREATE POLICY "tournaments_select" ON tournaments FOR SELECT
  USING (
    (deleted_at IS NULL AND (
      is_public
      OR auth.uid() = owner_id
      OR EXISTS (SELECT 1 FROM tournament_admins
        WHERE tournament_id = tournaments.id AND admin_id = auth.uid())
    ))
    OR is_site_admin()
  );
DROP POLICY IF EXISTS "tournaments_insert" ON tournaments;
CREATE POLICY "tournaments_insert" ON tournaments FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "tournaments_update" ON tournaments;
CREATE POLICY "tournaments_update" ON tournaments FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM tournament_admins
      WHERE tournament_id = tournaments.id AND admin_id = auth.uid()
      AND role IN ('owner','co_admin'))
    OR is_site_admin()
  );
DROP POLICY IF EXISTS "tournaments_delete" ON tournaments;
CREATE POLICY "tournaments_delete" ON tournaments FOR DELETE
  USING (auth.uid() = owner_id OR is_super_admin());

-- tournament_admins -----------------------------------------------------
ALTER TABLE tournament_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ta_select" ON tournament_admins;
CREATE POLICY "ta_select" ON tournament_admins FOR SELECT
  USING (
    admin_id = auth.uid()
    OR is_tournament_admin(tournament_id)
    OR is_site_admin()
  );
DROP POLICY IF EXISTS "ta_write" ON tournament_admins;
CREATE POLICY "ta_write" ON tournament_admins FOR ALL
  USING (
    EXISTS (SELECT 1 FROM tournaments
      WHERE id = tournament_id AND owner_id = auth.uid())
    OR is_site_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM tournaments
      WHERE id = tournament_id AND owner_id = auth.uid())
    OR is_site_admin()
  );

-- teams + players + team_members ---------------------------------------
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teams_select" ON teams;
CREATE POLICY "teams_select" ON teams FOR SELECT
  USING (can_view_tournament(tournament_id));
DROP POLICY IF EXISTS "teams_write" ON teams;
CREATE POLICY "teams_write" ON teams FOR ALL
  USING (is_tournament_admin(tournament_id))
  WITH CHECK (is_tournament_admin(tournament_id));

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "players_select" ON players;
CREATE POLICY "players_select" ON players FOR SELECT
  USING (can_view_tournament(tournament_id));
DROP POLICY IF EXISTS "players_write" ON players;
CREATE POLICY "players_write" ON players FOR ALL
  USING (is_tournament_admin(tournament_id))
  WITH CHECK (is_tournament_admin(tournament_id));

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tm_select" ON team_members;
CREATE POLICY "tm_select" ON team_members FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
      AND can_view_tournament(t.tournament_id))
  );
DROP POLICY IF EXISTS "tm_write" ON team_members;
CREATE POLICY "tm_write" ON team_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
      AND is_tournament_admin(t.tournament_id))
  );

-- matches + match_sets -------------------------------------------------
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matches_select" ON matches;
CREATE POLICY "matches_select" ON matches FOR SELECT
  USING (can_view_tournament(tournament_id));
DROP POLICY IF EXISTS "matches_write" ON matches;
CREATE POLICY "matches_write" ON matches FOR ALL
  USING (is_tournament_admin(tournament_id))
  WITH CHECK (is_tournament_admin(tournament_id));

ALTER TABLE match_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_sets_select" ON match_sets;
CREATE POLICY "match_sets_select" ON match_sets FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM matches m
      WHERE m.id = match_sets.match_id
      AND can_view_tournament(m.tournament_id))
  );
DROP POLICY IF EXISTS "match_sets_write" ON match_sets;
CREATE POLICY "match_sets_write" ON match_sets FOR ALL
  USING (
    EXISTS (SELECT 1 FROM matches m
      WHERE m.id = match_sets.match_id
      AND is_tournament_admin(m.tournament_id))
  );

-- audit_logs ------------------------------------------------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
CREATE POLICY "audit_select" ON audit_logs FOR SELECT
  USING (user_id = auth.uid() OR is_site_admin());
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (TRUE);

-- quick_brackets (anonymous) -------------------------------------------
ALTER TABLE quick_brackets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quick_select" ON quick_brackets;
CREATE POLICY "quick_select" ON quick_brackets FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "quick_insert" ON quick_brackets;
CREATE POLICY "quick_insert" ON quick_brackets FOR INSERT WITH CHECK (
  expires_at <= NOW() + interval '7 days'
  AND team_count BETWEEN 2 AND 64
  AND octet_length(data::text) < 50000
);
-- No update/delete from client; cleanup runs as service role.

-- user_bans + site_settings (admin) ------------------------------------
ALTER TABLE user_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_bans_self_read" ON user_bans;
CREATE POLICY "user_bans_self_read" ON user_bans FOR SELECT
  USING (user_id = auth.uid() OR is_site_admin());
DROP POLICY IF EXISTS "user_bans_admin_write" ON user_bans;
CREATE POLICY "user_bans_admin_write" ON user_bans FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_settings_read" ON site_settings;
CREATE POLICY "site_settings_read" ON site_settings FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "site_settings_write" ON site_settings;
CREATE POLICY "site_settings_write" ON site_settings FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- avoid_pairs / embed_config / short_urls / global_teams ---------------
ALTER TABLE avoid_pairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "avoid_pairs_select" ON avoid_pairs;
CREATE POLICY "avoid_pairs_select" ON avoid_pairs FOR SELECT
  USING (can_view_tournament(tournament_id));
DROP POLICY IF EXISTS "avoid_pairs_write" ON avoid_pairs;
CREATE POLICY "avoid_pairs_write" ON avoid_pairs FOR ALL
  USING (is_tournament_admin(tournament_id))
  WITH CHECK (is_tournament_admin(tournament_id));

ALTER TABLE tournament_embed_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "embed_select" ON tournament_embed_config;
CREATE POLICY "embed_select" ON tournament_embed_config FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "embed_write" ON tournament_embed_config;
CREATE POLICY "embed_write" ON tournament_embed_config FOR ALL
  USING (is_tournament_admin(tournament_id))
  WITH CHECK (is_tournament_admin(tournament_id));

ALTER TABLE short_urls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "short_urls_select" ON short_urls;
CREATE POLICY "short_urls_select" ON short_urls FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "short_urls_write" ON short_urls;
CREATE POLICY "short_urls_write" ON short_urls FOR ALL
  USING (
    EXISTS (SELECT 1 FROM tournaments
      WHERE id = short_urls.tournament_id AND owner_id = auth.uid())
  );

ALTER TABLE global_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "global_teams_select" ON global_teams;
CREATE POLICY "global_teams_select" ON global_teams FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "global_teams_write" ON global_teams;
CREATE POLICY "global_teams_write" ON global_teams FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
