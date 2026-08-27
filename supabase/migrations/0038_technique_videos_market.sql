-- Market split for technique videos: 'vn' = Vietnamese-language tutorials,
-- 'global' = English/worldwide. Existing rows were collected with English
-- queries, so they become 'global'.
ALTER TABLE technique_videos
  ADD COLUMN IF NOT EXISTS market TEXT NOT NULL DEFAULT 'global'
  CHECK (market IN ('vn', 'global'));

ALTER TABLE technique_videos DROP CONSTRAINT technique_videos_pkey;
ALTER TABLE technique_videos ADD PRIMARY KEY (technique, market, video_id);

DROP INDEX IF EXISTS technique_videos_list_idx;
CREATE INDEX IF NOT EXISTS technique_videos_list_idx
  ON technique_videos (technique, market, ai_score DESC, view_count DESC);
