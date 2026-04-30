-- 0016_pair_closed.sql — host can close lobby permanently
-- After close, the /pair/<code> route 404s for everyone.

ALTER TABLE pair_sessions DROP CONSTRAINT IF EXISTS pair_sessions_status_check;
ALTER TABLE pair_sessions
  ADD CONSTRAINT pair_sessions_status_check
  CHECK (status IN ('lobby','shuffling','shuffled','locked','closed'));
