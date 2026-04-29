-- 0005_storage_buckets.sql — Supabase storage bucket for team logos.
-- Run after Supabase Storage extension enabled (default).

INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload; tournament admins can update/delete their tournament's logos.
CREATE POLICY IF NOT EXISTS "team_logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'team-logos');

CREATE POLICY IF NOT EXISTS "team_logos_authenticated_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'team-logos' AND auth.uid() IS NOT NULL
  );

CREATE POLICY IF NOT EXISTS "team_logos_owner_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'team-logos' AND owner = auth.uid());

CREATE POLICY IF NOT EXISTS "team_logos_owner_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'team-logos' AND owner = auth.uid());
