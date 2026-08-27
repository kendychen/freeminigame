-- 0040_technique_flick.sql — new technique: flick / speed-up
INSERT INTO technique_refresh_state (slug) VALUES ('flick') ON CONFLICT (slug) DO NOTHING;
