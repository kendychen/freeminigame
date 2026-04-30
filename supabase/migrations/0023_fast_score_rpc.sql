-- 0023_fast_score_rpc.sql — single-roundtrip RPC for referee score updates
-- Original flow went browser → Vercel server action → 3-4 Supabase queries.
-- Each query is 150-300ms in Singapore so a +1 tap took 600-1200ms before
-- "Đang lưu" cleared. RPC runs SECURITY DEFINER server-side in a single
-- query, callable directly from the browser → ~200ms end-to-end.

-- Increment a single side's score using a scoped (group/bracket/match) token.
-- Returns the new {score_a, score_b, status, winner_team_id}.
CREATE OR REPLACE FUNCTION public.score_increment_by_scoped_token(
  p_token TEXT,
  p_match_id UUID,
  p_side TEXT,           -- 'a' | 'b'
  p_delta INT
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
  v_next_a INT;
  v_next_b INT;
  v_status TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 OR p_token !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;
  IF p_side NOT IN ('a','b') THEN
    RETURN jsonb_build_object('error', 'invalid_side');
  END IF;

  -- Resolve token (must be alive)
  SELECT scope, scope_value, tournament_id
    INTO v_scope, v_scope_value, v_tournament_id
  FROM referee_tokens
  WHERE token = p_token AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  -- Load match + verify it's in scope
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
    SET score_a = v_next_a,
        score_b = v_next_b,
        status = v_status
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

-- Reset a match to 0-0 by scoped token.
CREATE OR REPLACE FUNCTION public.score_reset_by_scoped_token(
  p_token TEXT,
  p_match_id UUID
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
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 OR p_token !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('error', 'invalid_token');
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
  UPDATE matches
    SET score_a = 0, score_b = 0, status = 'pending', winner_team_id = NULL
    WHERE id = p_match_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Finalize a match by scoped token (must have winner from current scores).
CREATE OR REPLACE FUNCTION public.score_finalize_by_scoped_token(
  p_token TEXT,
  p_match_id UUID
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
  IF v_match.score_a = v_match.score_b THEN
    RETURN jsonb_build_object('error', 'tie_score');
  END IF;
  v_winner := CASE WHEN v_match.score_a > v_match.score_b THEN v_match.team_a_id ELSE v_match.team_b_id END;
  v_loser := CASE WHEN v_match.score_a > v_match.score_b THEN v_match.team_b_id ELSE v_match.team_a_id END;
  IF v_winner IS NULL THEN RETURN jsonb_build_object('error', 'missing_team'); END IF;

  UPDATE matches SET status = 'completed', winner_team_id = v_winner
    WHERE id = p_match_id;

  -- Auto-advance into the next bracket slot if applicable
  IF v_match.bracket IN ('main','plate','winners','losers') AND v_match.next_win_match_id IS NOT NULL THEN
    SELECT team_a_id, team_b_id INTO v_target_a, v_target_b
      FROM matches WHERE id = v_match.next_win_match_id;
    IF v_target_a IS NULL THEN
      UPDATE matches SET team_a_id = v_winner WHERE id = v_match.next_win_match_id;
    ELSIF v_target_b IS NULL AND v_target_a <> v_winner THEN
      UPDATE matches SET team_b_id = v_winner WHERE id = v_match.next_win_match_id;
    END IF;
  END IF;
  IF v_match.bracket IN ('main','plate','winners','losers')
     AND v_match.next_loss_match_id IS NOT NULL AND v_loser IS NOT NULL THEN
    SELECT team_a_id, team_b_id INTO v_target_a, v_target_b
      FROM matches WHERE id = v_match.next_loss_match_id;
    IF v_target_a IS NULL THEN
      UPDATE matches SET team_a_id = v_loser WHERE id = v_match.next_loss_match_id;
    ELSIF v_target_b IS NULL AND v_target_a <> v_loser THEN
      UPDATE matches SET team_b_id = v_loser WHERE id = v_match.next_loss_match_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'winner_team_id', v_winner);
END;
$$;

-- Reopen a completed match by scoped token (clear winner, keep scores).
CREATE OR REPLACE FUNCTION public.score_reopen_by_scoped_token(
  p_token TEXT,
  p_match_id UUID
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
  v_status TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 OR p_token !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('error', 'invalid_token');
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
  END IF;
  v_status := CASE WHEN v_match.score_a + v_match.score_b > 0 THEN 'live' ELSE 'pending' END;
  UPDATE matches SET status = v_status, winner_team_id = NULL WHERE id = p_match_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.score_increment_by_scoped_token(TEXT, UUID, TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.score_reset_by_scoped_token(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.score_finalize_by_scoped_token(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.score_reopen_by_scoped_token(TEXT, UUID) TO anon, authenticated;
