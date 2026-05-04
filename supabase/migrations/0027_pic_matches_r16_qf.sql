-- Add 'r16' and 'quarterfinal' to pic_matches.stage check constraint
ALTER TABLE public.pic_matches
  DROP CONSTRAINT IF EXISTS pic_matches_stage_check;

ALTER TABLE public.pic_matches
  ADD CONSTRAINT pic_matches_stage_check
    CHECK (stage IN ('group','r16','quarterfinal','semifinal','final','third'));
