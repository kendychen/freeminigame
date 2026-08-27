-- 0041_pic_tv.sql — TV display mode for PIC events.
-- 1) pic_matches.quick_code links a match to the quick_scores row the referee
--    is scoring on, so viewers can show the in-progress score.
--    No FK: quick_scores rows expire and get purged; the link is advisory.
-- 2) pic_matches joins the realtime publication so viewer/TV pages receive
--    postgres_changes instead of requiring a manual reload. pic_events is left
--    out on purpose: 0033 grants SELECT per column (hiding referee_token) and
--    assumes no realtime subscription targets it; stage changes are polled.

ALTER TABLE public.pic_matches ADD COLUMN IF NOT EXISTS quick_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'pic_matches'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pic_matches';
  END IF;
END $$;
