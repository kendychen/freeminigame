-- 0018_seed_tags.sql — seed tags for balanced team draw
-- A free-form short label per player (e.g. 'A'/'B', 'Nam'/'Nữ', 'Pro'/'Newbie').
-- pair_sessions.draw_mode controls whether shuffle distributes randomly or
-- enforces one of each tag per group.

ALTER TABLE players ADD COLUMN IF NOT EXISTS seed_tag TEXT;

ALTER TABLE pair_sessions
  ADD COLUMN IF NOT EXISTS draw_mode TEXT NOT NULL DEFAULT 'random_all';

ALTER TABLE pair_sessions DROP CONSTRAINT IF EXISTS pair_sessions_draw_mode_check;
ALTER TABLE pair_sessions
  ADD CONSTRAINT pair_sessions_draw_mode_check
  CHECK (draw_mode IN ('random_all','balanced_by_tag'));
