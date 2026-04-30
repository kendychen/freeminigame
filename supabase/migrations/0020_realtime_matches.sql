-- 0020_realtime_matches.sql — opt the matches table into Realtime
-- Without this, postgres_changes events never fire on score updates,
-- so admin/viewer pages required a manual F5 to see referee score changes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'matches'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE matches';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'teams'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE teams';
  END IF;
END $$;
