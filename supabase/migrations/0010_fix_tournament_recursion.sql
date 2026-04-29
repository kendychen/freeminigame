-- 0010_fix_tournament_recursion.sql — eliminate RLS recursion
-- Issue: tournaments_select used EXISTS on tournament_admins, whose own
-- RLS policy called is_tournament_admin() which queried tournaments → recursion.

-- Helper that lists user's admin tournament ids, BYPASSES tournament_admins RLS.
CREATE OR REPLACE FUNCTION my_admin_tournament_ids() RETURNS SETOF UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tournament_id FROM tournament_admins WHERE admin_id = auth.uid();
$$;

-- Helper that lists user's owned tournament ids, BYPASSES tournaments RLS.
CREATE OR REPLACE FUNCTION my_owned_tournament_ids() RETURNS SETOF UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM tournaments WHERE owner_id = auth.uid() AND deleted_at IS NULL;
$$;

-- Rewrite tournaments_select WITHOUT EXISTS subquery → use helper.
DROP POLICY IF EXISTS "tournaments_select" ON tournaments;
CREATE POLICY "tournaments_select" ON tournaments FOR SELECT
  USING (
    (deleted_at IS NULL AND (
      is_public
      OR auth.uid() = owner_id
      OR id IN (SELECT my_admin_tournament_ids())
    ))
    OR is_site_admin()
  );

-- Rewrite ta_select: only call SECURITY DEFINER helpers, no inline EXISTS.
DROP POLICY IF EXISTS "ta_select" ON tournament_admins;
CREATE POLICY "ta_select" ON tournament_admins FOR SELECT
  USING (
    admin_id = auth.uid()
    OR tournament_id IN (SELECT my_owned_tournament_ids())
    OR is_site_admin()
  );

-- Rewrite ta_write similarly.
DROP POLICY IF EXISTS "ta_write" ON tournament_admins;
CREATE POLICY "ta_write" ON tournament_admins FOR ALL
  USING (
    tournament_id IN (SELECT my_owned_tournament_ids())
    OR is_site_admin()
  )
  WITH CHECK (
    tournament_id IN (SELECT my_owned_tournament_ids())
    OR is_site_admin()
  );

-- can_view_tournament uses SECURITY DEFINER + already self-contained, but
-- it queries tournaments which has policies that may reference helpers.
-- Inline the check directly (no recursion since SECURITY DEFINER).
CREATE OR REPLACE FUNCTION can_view_tournament(t_id UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = t_id
    AND t.deleted_at IS NULL
    AND (
      t.is_public
      OR t.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM tournament_admins ta
        WHERE ta.tournament_id = t_id AND ta.admin_id = auth.uid()
      )
    )
  ) OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND site_role IN ('moderator','super_admin')
  );
$$;

-- is_tournament_admin: same — fully self-contained, bypasses RLS via SECURITY DEFINER.
CREATE OR REPLACE FUNCTION is_tournament_admin(t_id UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE id = t_id AND owner_id = auth.uid() AND deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM tournament_admins
      WHERE tournament_id = t_id AND admin_id = auth.uid()
      AND role IN ('owner','co_admin')
    )
  );
$$;
