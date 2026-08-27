-- 0036_technique_videos.sql — Technique videos: machine-generated cache, admin overrides,
-- refresh cursor/lock, user ratings, user comments. Fully idempotent — safe to re-run.

-- máy sinh, có TTL
CREATE TABLE IF NOT EXISTS technique_videos (
  technique      TEXT NOT NULL,
  video_id       TEXT NOT NULL,
  title          TEXT NOT NULL,
  channel_title  TEXT NOT NULL,
  duration_sec   INT  NOT NULL,
  view_count     BIGINT NOT NULL DEFAULT 0,
  published_at   TIMESTAMPTZ NOT NULL,
  rank           INT  NOT NULL,               -- vị trí trong search, chỉ dùng chọn top-N
  ai_score       INT  NOT NULL,               -- 0..100
  ai_level       TEXT NOT NULL CHECK (ai_level IN ('basic','advanced')),
  ai_summary_vi  TEXT NOT NULL,
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (technique, video_id)
);
CREATE INDEX IF NOT EXISTS technique_videos_list_idx ON technique_videos (technique, ai_score DESC, view_count DESC);

-- admin, bền
CREATE TABLE IF NOT EXISTS technique_video_overrides (
  technique  TEXT NOT NULL,
  video_id   TEXT NOT NULL,
  status     TEXT CHECK (status IN ('hidden','gone')),   -- null = bình thường
  pinned     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (technique, video_id)
);

-- cursor + khoá refresh, 12 row seed từ taxonomy
CREATE TABLE IF NOT EXISTS technique_refresh_state (
  slug              TEXT PRIMARY KEY,
  last_refreshed_at TIMESTAMPTZ,
  locked_at         TIMESTAMPTZ,
  last_error        TEXT
);

-- người dùng
CREATE TABLE IF NOT EXISTS technique_video_ratings (
  technique  TEXT NOT NULL,
  video_id   TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stars      INT  NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (technique, video_id, user_id)
);

CREATE TABLE IF NOT EXISTS technique_video_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technique  TEXT NOT NULL,
  video_id   TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS technique_video_comments_video_idx
  ON technique_video_comments (technique, video_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS technique_video_comments_user_recent_idx
  ON technique_video_comments (user_id, created_at DESC);

CREATE OR REPLACE VIEW technique_video_rating_stats AS
  SELECT technique, video_id, ROUND(AVG(stars)::numeric, 1) AS avg_stars, COUNT(*) AS rating_count
  FROM technique_video_ratings GROUP BY technique, video_id;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE technique_videos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE technique_video_overrides  ENABLE ROW LEVEL SECURITY;
ALTER TABLE technique_refresh_state    ENABLE ROW LEVEL SECURITY;
ALTER TABLE technique_video_ratings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE technique_video_comments   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "technique_videos_select" ON technique_videos;
CREATE POLICY "technique_videos_select" ON technique_videos FOR SELECT USING (true);
DROP POLICY IF EXISTS "technique_video_overrides_select" ON technique_video_overrides;
CREATE POLICY "technique_video_overrides_select" ON technique_video_overrides FOR SELECT USING (true);
DROP POLICY IF EXISTS "technique_video_ratings_select" ON technique_video_ratings;
CREATE POLICY "technique_video_ratings_select" ON technique_video_ratings FOR SELECT USING (true);
DROP POLICY IF EXISTS "technique_video_comments_select" ON technique_video_comments;
CREATE POLICY "technique_video_comments_select" ON technique_video_comments FOR SELECT USING (deleted_at IS NULL);
-- technique_refresh_state: no policy → service role only

INSERT INTO technique_refresh_state (slug) VALUES
  ('serve'),('return'),('third-shot-drop'),('third-shot-drive'),('dink'),('volley'),
  ('reset'),('lob'),('overhead'),('erne'),('atp'),('footwork')
ON CONFLICT (slug) DO NOTHING;
