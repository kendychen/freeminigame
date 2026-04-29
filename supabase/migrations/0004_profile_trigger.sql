-- 0004_profile_trigger.sql — auto-create profile row when auth.users row is created.
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Bootstrap super_admin from Postgres setting `app.super_admin_email`.
DO $$
DECLARE
  super_email TEXT;
  super_uid UUID;
BEGIN
  super_email := current_setting('app.super_admin_email', true);
  IF super_email IS NOT NULL AND super_email <> '' THEN
    SELECT id INTO super_uid FROM auth.users WHERE email = super_email LIMIT 1;
    IF super_uid IS NOT NULL THEN
      INSERT INTO profiles (id, site_role) VALUES (super_uid, 'super_admin')
      ON CONFLICT (id) DO UPDATE SET site_role = 'super_admin';
    END IF;
  END IF;
END $$;
