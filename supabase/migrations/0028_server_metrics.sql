-- Function to read server-side metrics for the admin health dashboard.
-- Runs as SECURITY DEFINER (postgres owner) to access pg_stat_activity.
CREATE OR REPLACE FUNCTION get_server_metrics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'active_connections', (
      SELECT count(*)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND state IS NOT NULL
        AND pid <> pg_backend_pid()
    ),
    'idle_connections', (
      SELECT count(*)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND state = 'idle'
        AND pid <> pg_backend_pid()
    ),
    'total_connections', (
      SELECT count(*)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
    ),
    'db_size_mb', round(pg_database_size(current_database()) / 1024.0 / 1024.0, 1),
    'max_connections', current_setting('max_connections')::int
  );
$$;

GRANT EXECUTE ON FUNCTION get_server_metrics() TO service_role;
