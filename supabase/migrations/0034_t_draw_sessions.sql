-- 0034_t_draw_sessions.sql — Tournament LIVE draw sessions (per-entrant self-draw links)
-- Mirrors pic_individual_sessions (0029/0031) for the /t module. Modes:
--   'group' — each TEAM draws a random slot in a group (Group + Knockout)
--   'slot'  — each TEAM draws a random bracket position (Single/Double Elim, Swiss, RR)
--   'pair'  — each PLAYER draws a random team slot (bốc thăm ghép đôi);
--             slot_tags optionally restricts positions by players.seed_tag (vd 1=Nam, 2=Nữ)

CREATE TABLE IF NOT EXISTS t_draw_sessions (
  code TEXT PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  host_token TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('group','slot','pair')),
  slot_sizes JSONB NOT NULL,            -- [size, ...] per bucket (group/team) — slot mode: [1,1,...]
  slot_tags JSONB,                      -- { "1": "Nam", "2": "Nữ" } | NULL (pair mode only)
  entrant_tokens JSONB NOT NULL,        -- { entrantId: token } (teamId or playerId)
  assignments JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { entrantId: { g, p } }
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'applied', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_t_draw_tournament ON t_draw_sessions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_t_draw_expires ON t_draw_sessions(expires_at);

ALTER TABLE t_draw_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "t_draw_select" ON t_draw_sessions;
CREATE POLICY "t_draw_select" ON t_draw_sessions FOR SELECT USING (TRUE);

-- All writes via service_role server actions (host/entrant tokens validated in code).

-- Atomic random empty-slot pick (SELECT ... FOR UPDATE). p_allowed_p restricts the
-- slot position within buckets (pair mode with tag constraint: Nam → p=1, Nữ → p=2).
CREATE OR REPLACE FUNCTION t_draw_tap(
  p_code TEXT,
  p_entrant_id UUID,
  p_allowed_p INT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_session t_draw_sessions%ROWTYPE;
  v_sizes INT[];
  v_assignments JSONB;
  v_occupied TEXT[];
  v_available JSONB[];
  v_chosen JSONB;
  v_g INT;
  v_p INT;
BEGIN
  SELECT * INTO v_session
  FROM t_draw_sessions
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF v_session.status <> 'active' THEN RAISE EXCEPTION 'session_not_active'; END IF;

  v_assignments := v_session.assignments;
  IF v_assignments ? p_entrant_id::text THEN RAISE EXCEPTION 'already_drawn'; END IF;
  IF NOT (v_session.entrant_tokens ? p_entrant_id::text) THEN RAISE EXCEPTION 'invalid_entrant'; END IF;

  SELECT array_agg((value)::int ORDER BY ordinality)
  INTO v_sizes
  FROM jsonb_array_elements_text(v_session.slot_sizes) WITH ORDINALITY;

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
      IF (p_allowed_p IS NULL OR v_p = p_allowed_p)
         AND NOT (v_g || '-' || v_p) = ANY(v_occupied) THEN
        v_available := array_append(v_available, jsonb_build_object('g', v_g, 'p', v_p));
      END IF;
    END LOOP;
  END LOOP;

  IF array_length(v_available, 1) IS NULL OR array_length(v_available, 1) = 0 THEN
    RAISE EXCEPTION 'all_slots_full';
  END IF;

  v_chosen := v_available[1 + floor(random() * array_length(v_available, 1))::int];

  UPDATE t_draw_sessions
  SET assignments = v_assignments || jsonb_build_object(p_entrant_id::text, v_chosen),
      updated_at = NOW()
  WHERE code = p_code;

  RETURN v_chosen;
END;
$fn$;

GRANT EXECUTE ON FUNCTION t_draw_tap(TEXT, UUID, INT) TO anon, authenticated, service_role;

-- Realtime (guarded — safe to re-run)
DO $do$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE t_draw_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;
