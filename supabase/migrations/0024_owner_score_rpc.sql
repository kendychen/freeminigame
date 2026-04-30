-- 0024_owner_score_rpc.sql — fast RPC for the authed referee path
-- Mirrors 0023 but for the /t/<slug>/referee/<matchId> page where the user
-- is logged in and must be owner / co_admin of the tournament. Drops the
-- 600-1000ms server-action chain to a single ~200ms supabase.rpc call.

-- Reuse existing public.is_tournament_admin(uuid) from 0010 — its parameter
-- name is t_id (different from p_tournament_id) but signature matches.
-- We just verify it returns the right shape; otherwise inline the check.

CREATE OR REPLACE FUNCTION public.score_increment_by_owner(
  p_match_id UUID,
  p_side TEXT,
  p_delta INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_next_a INT;
  v_next_b INT;
  v_status TEXT;
BEGIN
  IF p_side NOT IN ('a','b') THEN
    RETURN jsonb_build_object('error', 'invalid_side');
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF NOT public.is_tournament_admin(v_match.tournament_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  v_next_a := GREATEST(0, v_match.score_a + CASE WHEN p_side = 'a' THEN p_delta ELSE 0 END);
  v_next_b := GREATEST(0, v_match.score_b + CASE WHEN p_side = 'b' THEN p_delta ELSE 0 END);
  IF v_match.status = 'completed' THEN
    v_status := 'completed';
  ELSIF v_next_a + v_next_b > 0 THEN
    v_status := 'live';
  ELSE
    v_status := 'pending';
  END IF;

  UPDATE matches
    SET score_a = v_next_a, score_b = v_next_b, status = v_status, updated_by = auth.uid()
    WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'ok', true,
    'score_a', v_next_a,
    'score_b', v_next_b,
    'status', v_status,
    'winner_team_id', v_match.winner_team_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.score_reset_by_owner(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_match RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;
  SELECT tournament_id INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF NOT public.is_tournament_admin(v_match.tournament_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;
  UPDATE matches
    SET score_a = 0, score_b = 0, status = 'pending', winner_team_id = NULL,
        updated_by = auth.uid()
    WHERE id = p_match_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.score_finalize_by_owner(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_winner UUID;
  v_loser UUID;
  v_target_a UUID;
  v_target_b UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF NOT public.is_tournament_admin(v_match.tournament_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;
  IF v_match.score_a = v_match.score_b THEN
    RETURN jsonb_build_object('error', 'tie_score');
  END IF;
  v_winner := CASE WHEN v_match.score_a > v_match.score_b THEN v_match.team_a_id ELSE v_match.team_b_id END;
  v_loser  := CASE WHEN v_match.score_a > v_match.score_b THEN v_match.team_b_id ELSE v_match.team_a_id END;
  IF v_winner IS NULL THEN RETURN jsonb_build_object('error', 'missing_team'); END IF;

  UPDATE matches
    SET status = 'completed', winner_team_id = v_winner, updated_by = auth.uid()
    WHERE id = p_match_id;

  IF v_match.bracket IN ('main','plate','winners','losers') AND v_match.next_win_match_id IS NOT NULL THEN
    SELECT team_a_id, team_b_id INTO v_target_a, v_target_b FROM matches WHERE id = v_match.next_win_match_id;
    IF v_target_a IS NULL THEN
      UPDATE matches SET team_a_id = v_winner WHERE id = v_match.next_win_match_id;
    ELSIF v_target_b IS NULL AND v_target_a <> v_winner THEN
      UPDATE matches SET team_b_id = v_winner WHERE id = v_match.next_win_match_id;
    END IF;
  END IF;
  IF v_match.bracket IN ('main','plate','winners','losers')
     AND v_match.next_loss_match_id IS NOT NULL AND v_loser IS NOT NULL THEN
    SELECT team_a_id, team_b_id INTO v_target_a, v_target_b FROM matches WHERE id = v_match.next_loss_match_id;
    IF v_target_a IS NULL THEN
      UPDATE matches SET team_a_id = v_loser WHERE id = v_match.next_loss_match_id;
    ELSIF v_target_b IS NULL AND v_target_a <> v_loser THEN
      UPDATE matches SET team_b_id = v_loser WHERE id = v_match.next_loss_match_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'winner_team_id', v_winner);
END;
$$;

CREATE OR REPLACE FUNCTION public.score_reopen_by_owner(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_match RECORD; v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF NOT public.is_tournament_admin(v_match.tournament_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;
  v_status := CASE WHEN v_match.score_a + v_match.score_b > 0 THEN 'live' ELSE 'pending' END;
  UPDATE matches
    SET status = v_status, winner_team_id = NULL, updated_by = auth.uid()
    WHERE id = p_match_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.score_increment_by_owner(UUID, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.score_reset_by_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.score_finalize_by_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.score_reopen_by_owner(UUID) TO authenticated;
