-- 0025_finalize_with_scores.sql — finalize RPCs accept the final scores
-- Local-first scoring: referee taps +/- only update client state.
-- One server write happens on Kết thúc, with the final scoreA + scoreB.

CREATE OR REPLACE FUNCTION public.score_finalize_by_owner(
  p_match_id UUID,
  p_score_a INT,
  p_score_b INT
) RETURNS JSONB
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
  IF p_score_a < 0 OR p_score_b < 0 THEN
    RETURN jsonb_build_object('error', 'negative_score');
  END IF;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF NOT public.is_tournament_admin(v_match.tournament_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;
  IF p_score_a = p_score_b THEN
    RETURN jsonb_build_object('error', 'tie_score');
  END IF;
  v_winner := CASE WHEN p_score_a > p_score_b THEN v_match.team_a_id ELSE v_match.team_b_id END;
  v_loser  := CASE WHEN p_score_a > p_score_b THEN v_match.team_b_id ELSE v_match.team_a_id END;
  IF v_winner IS NULL THEN RETURN jsonb_build_object('error', 'missing_team'); END IF;

  UPDATE matches
    SET score_a = p_score_a, score_b = p_score_b,
        status = 'completed', winner_team_id = v_winner,
        updated_by = auth.uid()
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

CREATE OR REPLACE FUNCTION public.score_finalize_by_scoped_token(
  p_token TEXT,
  p_match_id UUID,
  p_score_a INT,
  p_score_b INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope TEXT;
  v_scope_value TEXT;
  v_tournament_id UUID;
  v_match RECORD;
  v_winner UUID;
  v_loser UUID;
  v_target_a UUID;
  v_target_b UUID;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 OR p_token !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;
  IF p_score_a < 0 OR p_score_b < 0 THEN
    RETURN jsonb_build_object('error', 'negative_score');
  END IF;
  SELECT scope, scope_value, tournament_id
    INTO v_scope, v_scope_value, v_tournament_id
  FROM referee_tokens WHERE token = p_token AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'invalid_token'); END IF;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND OR v_match.tournament_id <> v_tournament_id THEN
    RETURN jsonb_build_object('error', 'match_not_in_scope');
  END IF;
  IF v_scope = 'group' AND v_match.group_label IS DISTINCT FROM v_scope_value THEN
    RETURN jsonb_build_object('error', 'match_not_in_scope');
  ELSIF v_scope = 'bracket' AND v_match.bracket <> v_scope_value THEN
    RETURN jsonb_build_object('error', 'match_not_in_scope');
  ELSIF v_scope = 'match' AND v_match.id::TEXT <> v_scope_value THEN
    RETURN jsonb_build_object('error', 'match_not_in_scope');
  END IF;
  IF p_score_a = p_score_b THEN
    RETURN jsonb_build_object('error', 'tie_score');
  END IF;
  v_winner := CASE WHEN p_score_a > p_score_b THEN v_match.team_a_id ELSE v_match.team_b_id END;
  v_loser  := CASE WHEN p_score_a > p_score_b THEN v_match.team_b_id ELSE v_match.team_a_id END;
  IF v_winner IS NULL THEN RETURN jsonb_build_object('error', 'missing_team'); END IF;

  UPDATE matches
    SET score_a = p_score_a, score_b = p_score_b,
        status = 'completed', winner_team_id = v_winner
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

GRANT EXECUTE ON FUNCTION public.score_finalize_by_owner(UUID, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.score_finalize_by_scoped_token(TEXT, UUID, INT, INT) TO anon, authenticated;
