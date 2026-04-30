-- 0017_chat_messages.sql — persistent ephemeral chat for lobbies
-- Anyone with the channel key (lobby code or tournament id) can read/insert.
-- TTL handled by purging on lobby close + a 7-day floor cleanup.

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_key TEXT NOT NULL,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 32),
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_channel_created
  ON chat_messages(channel_key, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_read_all ON chat_messages;
CREATE POLICY chat_read_all
  ON chat_messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS chat_insert_all ON chat_messages;
CREATE POLICY chat_insert_all
  ON chat_messages FOR INSERT
  WITH CHECK (
    length(display_name) BETWEEN 1 AND 32
    AND length(text) BETWEEN 1 AND 500
    AND length(channel_key) BETWEEN 3 AND 100
  );

-- Realtime publication so client postgres_changes works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages';
  END IF;
END $$;
