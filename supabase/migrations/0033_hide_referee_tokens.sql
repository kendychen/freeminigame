-- 0033_hide_referee_tokens.sql — column-level SELECT privileges for referee tokens
-- The "select USING (true)" RLS policies on pic_events/team_events expose whole
-- rows, and Supabase's default grants give anon/authenticated SELECT on every
-- column — so referee_token was readable by anyone holding the public anon key
-- (GET /rest/v1/team_events?select=slug,referee_token), defeating the owner-only
-- masking in loadPicEventState/loadTeamEventState.
-- Fix: revoke table-wide SELECT from anon/authenticated and grant it back on
-- every column except referee_token. All app reads of these two tables go
-- through the service client (service_role keeps full access) and no realtime
-- subscription targets them, so nothing breaks.
-- Idempotent — safe to re-run. Apply: node scripts/apply-migration.mjs supabase/migrations/0033_hide_referee_tokens.sql

REVOKE SELECT ON public.pic_events FROM anon, authenticated;
GRANT SELECT (id, name, slug, owner_id, config, stage, created_at, updated_at)
  ON public.pic_events TO anon, authenticated;

REVOKE SELECT ON public.team_events FROM anon, authenticated;
GRANT SELECT (id, name, slug, owner_id, config, stage, created_at, updated_at)
  ON public.team_events TO anon, authenticated;
