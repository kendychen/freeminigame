-- PIC (Pickleball Individual Competition) xoay cặp — standalone event tables

CREATE TABLE public.pic_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL DEFAULT 'Giải PIC',
  slug          TEXT        NOT NULL UNIQUE,
  owner_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  config        JSONB       NOT NULL DEFAULT '{
    "targetGroup": 11,
    "targetKnockout": 15,
    "advancePerGroup": 1,
    "hasThirdPlace": false
  }'::JSONB,
  stage         TEXT        NOT NULL DEFAULT 'group'
                            CHECK (stage IN ('group','draw','knockout','done')),
  referee_token TEXT        UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pic_players (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.pic_events(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pic_groups (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.pic_events(id) ON DELETE CASCADE,
  label      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pic_group_players (
  group_id   UUID NOT NULL REFERENCES public.pic_groups(id)  ON DELETE CASCADE,
  player_id  UUID NOT NULL REFERENCES public.pic_players(id) ON DELETE CASCADE,
  seed       INT,
  PRIMARY KEY (group_id, player_id)
);

CREATE TABLE public.pic_matches (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.pic_events(id) ON DELETE CASCADE,
  group_id   UUID        REFERENCES public.pic_groups(id) ON DELETE CASCADE,
  round      INT         NOT NULL DEFAULT 1,
  stage      TEXT        NOT NULL DEFAULT 'group'
                         CHECK (stage IN ('group','semifinal','final','third')),
  a1_id      UUID        REFERENCES public.pic_players(id),
  a2_id      UUID        REFERENCES public.pic_players(id),
  b1_id      UUID        REFERENCES public.pic_players(id),
  b2_id      UUID        REFERENCES public.pic_players(id),
  score_a    INT         NOT NULL DEFAULT 0,
  score_b    INT         NOT NULL DEFAULT 0,
  status     TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.pic_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pic_players       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pic_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pic_group_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pic_matches       ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "pic_events_select"        ON public.pic_events        FOR SELECT USING (true);
CREATE POLICY "pic_players_select"       ON public.pic_players       FOR SELECT USING (true);
CREATE POLICY "pic_groups_select"        ON public.pic_groups        FOR SELECT USING (true);
CREATE POLICY "pic_group_players_select" ON public.pic_group_players FOR SELECT USING (true);
CREATE POLICY "pic_matches_select"       ON public.pic_matches       FOR SELECT USING (true);

-- Owner write (service role bypasses RLS for referee paths)
CREATE POLICY "pic_events_owner"   ON public.pic_events
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "pic_players_owner"  ON public.pic_players
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.pic_events WHERE id = event_id AND owner_id = auth.uid())
  );

CREATE POLICY "pic_groups_owner"   ON public.pic_groups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.pic_events WHERE id = event_id AND owner_id = auth.uid())
  );

CREATE POLICY "pic_group_players_owner" ON public.pic_group_players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.pic_groups g
      JOIN public.pic_events e ON e.id = g.event_id
      WHERE g.id = group_id AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY "pic_matches_owner"  ON public.pic_matches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.pic_events WHERE id = event_id AND owner_id = auth.uid())
  );
