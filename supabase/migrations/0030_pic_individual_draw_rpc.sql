-- 0030_pic_individual_draw_rpc.sql — Atomic tap RPC for PIC individual LIVE draw
-- Uses SELECT FOR UPDATE to prevent race conditions when multiple players tap simultaneously.

CREATE OR REPLACE FUNCTION pic_individual_draw_tap(
  p_code TEXT,
  p_player_id UUID
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session pic_individual_sessions%ROWTYPE;
  v_sizes INT[];
  v_assignments JSONB;
  v_counts INT[];
  v_available INT[];
  v_chosen INT;
  v_i INT;
BEGIN
  -- Lock the session row
  SELECT * INTO v_session
  FROM pic_individual_sessions
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;
  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'session_not_active';
  END IF;

  v_assignments := v_session.assignments;

  -- Player already drawn?
  IF v_assignments ? p_player_id::text THEN
    RAISE EXCEPTION 'already_drawn';
  END IF;

  -- Player exists in this session?
  IF NOT (v_session.player_tokens ? p_player_id::text) THEN
    RAISE EXCEPTION 'invalid_player';
  END IF;

  -- Parse group_sizes (JSONB int array)
  SELECT array_agg((value)::int ORDER BY ordinality)
  INTO v_sizes
  FROM jsonb_array_elements_text(v_session.group_sizes) WITH ORDINALITY;

  -- Compute current counts per group
  v_counts := array_fill(0, ARRAY[array_length(v_sizes, 1)]);
  FOR v_i IN
    SELECT (value)::int FROM jsonb_each_text(v_assignments)
  LOOP
    v_counts[v_i + 1] := v_counts[v_i + 1] + 1;
  END LOOP;

  -- Find groups with capacity
  v_available := ARRAY[]::INT[];
  FOR v_i IN 1 .. array_length(v_sizes, 1) LOOP
    IF v_counts[v_i] < v_sizes[v_i] THEN
      v_available := array_append(v_available, v_i - 1);
    END IF;
  END LOOP;

  IF array_length(v_available, 1) IS NULL OR array_length(v_available, 1) = 0 THEN
    RAISE EXCEPTION 'all_groups_full';
  END IF;

  -- Pick random
  v_chosen := v_available[1 + floor(random() * array_length(v_available, 1))::int];

  -- Update assignments
  UPDATE pic_individual_sessions
  SET assignments = v_assignments || jsonb_build_object(p_player_id::text, v_chosen),
      updated_at = NOW()
  WHERE code = p_code;

  RETURN v_chosen;
END;
$$;

GRANT EXECUTE ON FUNCTION pic_individual_draw_tap(TEXT, UUID) TO anon, authenticated, service_role;
