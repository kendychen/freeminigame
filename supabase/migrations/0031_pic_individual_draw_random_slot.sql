-- 0031_pic_individual_draw_random_slot.sql — Pick random EMPTY SLOT (g, p) not just group
-- assignments now stores { playerId: { g: groupIdx, p: slotPosition } }
-- RPC returns JSONB { g, p }

-- Drop old function (return type change)
DROP FUNCTION IF EXISTS pic_individual_draw_tap(TEXT, UUID);

CREATE OR REPLACE FUNCTION pic_individual_draw_tap(
  p_code TEXT,
  p_player_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session pic_individual_sessions%ROWTYPE;
  v_sizes INT[];
  v_assignments JSONB;
  v_occupied TEXT[];
  v_available JSONB[];
  v_chosen JSONB;
  v_g INT;
  v_p INT;
BEGIN
  SELECT * INTO v_session
  FROM pic_individual_sessions
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF v_session.status <> 'active' THEN RAISE EXCEPTION 'session_not_active'; END IF;

  v_assignments := v_session.assignments;
  IF v_assignments ? p_player_id::text THEN RAISE EXCEPTION 'already_drawn'; END IF;
  IF NOT (v_session.player_tokens ? p_player_id::text) THEN RAISE EXCEPTION 'invalid_player'; END IF;

  SELECT array_agg((value)::int ORDER BY ordinality)
  INTO v_sizes
  FROM jsonb_array_elements_text(v_session.group_sizes) WITH ORDINALITY;

  -- Build set of occupied "g-p" keys from current assignments (new format: {g, p})
  v_occupied := COALESCE(
    ARRAY(
      SELECT (value ->> 'g') || '-' || (value ->> 'p')
      FROM jsonb_each(v_assignments)
      WHERE jsonb_typeof(value) = 'object' AND value ? 'g' AND value ? 'p'
    ),
    ARRAY[]::TEXT[]
  );

  -- Enumerate empty slots across all groups
  v_available := ARRAY[]::JSONB[];
  FOR v_g IN 0 .. array_length(v_sizes, 1) - 1 LOOP
    FOR v_p IN 1 .. v_sizes[v_g + 1] LOOP
      IF NOT (v_g || '-' || v_p) = ANY(v_occupied) THEN
        v_available := array_append(v_available, jsonb_build_object('g', v_g, 'p', v_p));
      END IF;
    END LOOP;
  END LOOP;

  IF array_length(v_available, 1) IS NULL OR array_length(v_available, 1) = 0 THEN
    RAISE EXCEPTION 'all_slots_full';
  END IF;

  v_chosen := v_available[1 + floor(random() * array_length(v_available, 1))::int];

  UPDATE pic_individual_sessions
  SET assignments = v_assignments || jsonb_build_object(p_player_id::text, v_chosen),
      updated_at = NOW()
  WHERE code = p_code;

  RETURN v_chosen;
END;
$$;

GRANT EXECUTE ON FUNCTION pic_individual_draw_tap(TEXT, UUID) TO anon, authenticated, service_role;
