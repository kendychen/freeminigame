-- 0006_stats_views.sql — cross-tournament stats with security_invoker.

CREATE OR REPLACE VIEW team_stats
  WITH (security_invoker = on) AS
SELECT
  t.id AS team_id,
  t.global_team_id,
  t.name,
  t.tournament_id,
  COUNT(*) FILTER (WHERE m.status = 'completed') AS matches_played,
  COUNT(*) FILTER (
    WHERE m.status = 'completed' AND m.winner_team_id = t.id
  ) AS wins,
  COUNT(*) FILTER (
    WHERE m.status = 'completed' AND m.winner_team_id IS NOT NULL
      AND m.winner_team_id <> t.id
  ) AS losses,
  COALESCE(
    SUM(CASE
      WHEN m.team_a_id = t.id THEN m.score_a
      WHEN m.team_b_id = t.id THEN m.score_b
    END) FILTER (WHERE m.status = 'completed'), 0
  ) AS goals_for,
  COALESCE(
    SUM(CASE
      WHEN m.team_a_id = t.id THEN m.score_b
      WHEN m.team_b_id = t.id THEN m.score_a
    END) FILTER (WHERE m.status = 'completed'), 0
  ) AS goals_against
FROM teams t
LEFT JOIN matches m
  ON (m.team_a_id = t.id OR m.team_b_id = t.id)
GROUP BY t.id, t.global_team_id, t.name, t.tournament_id;

CREATE OR REPLACE VIEW user_tournament_history
  WITH (security_invoker = on) AS
SELECT
  ta.admin_id AS user_id,
  t.id AS tournament_id,
  t.slug,
  t.name,
  t.format,
  t.status,
  ta.role,
  t.created_at
FROM tournaments t
JOIN tournament_admins ta ON ta.tournament_id = t.id
WHERE t.deleted_at IS NULL;

CREATE OR REPLACE VIEW tournament_mvp
  WITH (security_invoker = on) AS
SELECT DISTINCT ON (tournament_id)
  t.tournament_id,
  t.team_id,
  t.name,
  t.wins
FROM team_stats t
ORDER BY tournament_id, wins DESC, name ASC;
