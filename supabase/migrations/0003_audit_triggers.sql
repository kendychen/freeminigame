-- 0003_audit_triggers.sql — audit log triggers
-- Uses SECURITY INVOKER so auth.uid() and JWT claims are visible.

CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
DECLARE
  uid UUID;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    BEGIN
      uid := nullif(current_setting('request.jwt.claim.sub', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
      uid := NULL;
    END;
  END IF;
  INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, user_id)
  VALUES (
    TG_OP,
    TG_TABLE_NAME,
    COALESCE((NEW).id::TEXT, (OLD).id::TEXT),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    uid
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS trg_audit_tournaments ON tournaments;
CREATE TRIGGER trg_audit_tournaments
  AFTER INSERT OR UPDATE OR DELETE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_matches ON matches;
CREATE TRIGGER trg_audit_matches
  AFTER UPDATE OR DELETE ON matches
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_match_sets ON match_sets;
CREATE TRIGGER trg_audit_match_sets
  AFTER INSERT OR UPDATE OR DELETE ON match_sets
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_user_bans ON user_bans;
CREATE TRIGGER trg_audit_user_bans
  AFTER INSERT OR UPDATE OR DELETE ON user_bans
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- match_sets winner roll-up: when a set is updated, recompute matches.winner_team_id
CREATE OR REPLACE FUNCTION update_match_winner_from_sets() RETURNS TRIGGER AS $$
DECLARE
  m_id UUID;
  m RECORD;
  set_count_a INT;
  set_count_b INT;
  total_a INT;
  total_b INT;
  needed INT;
  winner UUID;
  match_status TEXT;
BEGIN
  m_id := COALESCE(NEW.match_id, OLD.match_id);
  SELECT * INTO m FROM matches WHERE id = m_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  needed := CASE m.series_format WHEN 'bo1' THEN 1 WHEN 'bo3' THEN 2 ELSE 3 END;

  SELECT
    COUNT(*) FILTER (WHERE winner_team_id = m.team_a_id),
    COUNT(*) FILTER (WHERE winner_team_id = m.team_b_id),
    COALESCE(SUM(score_a),0),
    COALESCE(SUM(score_b),0)
  INTO set_count_a, set_count_b, total_a, total_b
  FROM match_sets WHERE match_id = m_id;

  winner := NULL;
  match_status := m.status;
  IF set_count_a >= needed THEN winner := m.team_a_id; match_status := 'completed';
  ELSIF set_count_b >= needed THEN winner := m.team_b_id; match_status := 'completed';
  ELSIF total_a + total_b > 0 THEN match_status := 'live';
  END IF;

  UPDATE matches
    SET winner_team_id = winner,
        score_a = total_a,
        score_b = total_b,
        status = match_status,
        updated_at = NOW()
    WHERE id = m_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_match_sets_rollup ON match_sets;
CREATE TRIGGER trg_match_sets_rollup
  AFTER INSERT OR UPDATE OR DELETE ON match_sets
  FOR EACH ROW EXECUTE FUNCTION update_match_winner_from_sets();
