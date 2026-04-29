-- 0008_pair_shuffling.sql — add shuffling state for animation broadcast
ALTER TABLE pair_sessions
  DROP CONSTRAINT IF EXISTS pair_sessions_status_check;

ALTER TABLE pair_sessions
  ADD CONSTRAINT pair_sessions_status_check
  CHECK (status IN ('lobby','shuffling','shuffled','locked'));

ALTER TABLE pair_sessions
  ADD COLUMN IF NOT EXISTS shuffling_until TIMESTAMPTZ;
