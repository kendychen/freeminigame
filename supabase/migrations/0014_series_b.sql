-- 0014_series_b.sql — add Plate (Series B / Cúp phụ) bracket support
-- Allows top-N teams per group → main, next-M → plate consolation bracket.

-- 1. Extend matches.bracket CHECK to include 'plate'
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_bracket_check;
ALTER TABLE matches
  ADD CONSTRAINT matches_bracket_check
  CHECK (bracket IN ('main','winners','losers','grand_final','group','plate'));

-- 2. Document config keys (no schema change — config is JSONB)
-- Expected keys on tournaments.config:
--   plateEnabled: boolean (default false)
--   qualifyPerGroup: number (default 2)  -- top-N → main
--   qualifyPlatePerGroup: number (default 1) -- next-M → plate
COMMENT ON COLUMN tournaments.config IS
  'JSONB. Keys: seriesFormat, groupSize, qualifyPerGroup, doubleRound, tiebreakers, randomSeed, plateEnabled, qualifyPlatePerGroup';
