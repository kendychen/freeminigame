-- 0011_auto_owner_admin.sql — auto-insert tournament_admins(owner) on tournament create.
-- Defensive: server action also tries this, but trigger is the source of truth.

CREATE OR REPLACE FUNCTION ensure_owner_admin() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tournament_admins (tournament_id, admin_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (tournament_id, admin_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tournaments_ensure_owner_admin ON tournaments;
CREATE TRIGGER trg_tournaments_ensure_owner_admin
  AFTER INSERT ON tournaments
  FOR EACH ROW EXECUTE FUNCTION ensure_owner_admin();
