-- 0035_pic_ko_draw.sql — LIVE knockout PAIR draw + gender-quota group draw
-- pic_individual_sessions gains:
--   kind      : 'group' (existing behaviour) | 'ko_pairs' (bốc cặp knockout)
--   slot_tags : JSONB map { "g-p": "Nam"|"Nữ"|"A"|"B" } — per-slot tag constraint.
--               NULL = no constraint. Used for Nam/Nữ quota per group and for
--               pair slots (1 Nam + 1 Nữ, or 1 A + 1 B).

ALTER TABLE pic_individual_sessions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'group';
ALTER TABLE pic_individual_sessions ADD COLUMN IF NOT EXISTS slot_tags JSONB;

DO $do$
BEGIN
  ALTER TABLE pic_individual_sessions
    ADD CONSTRAINT pic_indiv_kind_check CHECK (kind IN ('group', 'ko_pairs'));
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;

-- Extend the atomic tap RPC with an optional tag filter (p_tag): the player may
-- only land on empty slots whose slot_tags entry equals p_tag. Old 2-arg
-- callers keep working via the DEFAULT NULL parameter.
DROP FUNCTION IF EXISTS pic_individual_draw_tap(TEXT, UUID);

CREATE OR REPLACE FUNCTION pic_individual_draw_tap(
  p_code TEXT,
  p_player_id UUID,
  p_tag TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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

  v_occupied := COALESCE(
    ARRAY(
      SELECT (value ->> 'g') || '-' || (value ->> 'p')
      FROM jsonb_each(v_assignments)
      WHERE jsonb_typeof(value) = 'object' AND value ? 'g' AND value ? 'p'
    ),
    ARRAY[]::TEXT[]
  );

  v_available := ARRAY[]::JSONB[];
  FOR v_g IN 0 .. array_length(v_sizes, 1) - 1 LOOP
    FOR v_p IN 1 .. v_sizes[v_g + 1] LOOP
      IF NOT (v_g || '-' || v_p) = ANY(v_occupied)
         AND (
           p_tag IS NULL
           OR v_session.slot_tags IS NULL
           OR v_session.slot_tags ->> (v_g || '-' || v_p) = p_tag
         ) THEN
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
$fn$;

GRANT EXECUTE ON FUNCTION pic_individual_draw_tap(TEXT, UUID, TEXT) TO anon, authenticated, service_role;
