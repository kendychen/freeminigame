-- 0009_fix_rls_helpers.sql — convert RLS helpers to SECURITY DEFINER
-- Prevents potential recursion + permission issues when called from policies.

CREATE OR REPLACE FUNCTION is_site_admin() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles
    WHERE id = auth.uid() AND site_role IN ('moderator','super_admin'));
$$;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles
    WHERE id = auth.uid() AND site_role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION is_tournament_admin(t_id UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM tournaments WHERE id = t_id AND owner_id = auth.uid() AND deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM tournament_admins
      WHERE tournament_id = t_id AND admin_id = auth.uid()
      AND role IN ('owner','co_admin'))
  );
$$;

CREATE OR REPLACE FUNCTION can_view_tournament(t_id UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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

-- Backfill any auth.users without profile (handle_new_user trigger may have missed early signups)
INSERT INTO profiles (id, display_name)
SELECT u.id, COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill tournament_admins for tournaments where owner is missing from admins table
INSERT INTO tournament_admins (tournament_id, admin_id, role)
SELECT t.id, t.owner_id, 'owner'
FROM tournaments t
WHERE NOT EXISTS (
  SELECT 1 FROM tournament_admins ta
  WHERE ta.tournament_id = t.id AND ta.admin_id = t.owner_id
)
ON CONFLICT (tournament_id, admin_id) DO NOTHING;
