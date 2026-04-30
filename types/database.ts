/**
 * Generated DB types — minimal hand-written subset.
 * Replace with `supabase gen types typescript` output once Supabase project is live.
 */

export type TournamentFormat =
  | "single_elim"
  | "double_elim"
  | "round_robin"
  | "swiss"
  | "group_knockout";

export type TournamentStatus =
  | "draft"
  | "running"
  | "completed"
  | "archived";

export type AdminRole = "owner" | "co_admin" | "viewer";
export type SiteRole = "user" | "moderator" | "super_admin";
export type MatchStatus = "pending" | "live" | "completed" | "bye";
export type SeriesFormat = "bo1" | "bo3" | "bo5";
export type BracketSection =
  | "main"
  | "winners"
  | "losers"
  | "grand_final"
  | "group"
  | "plate";

export interface DbProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  site_role: SiteRole;
  created_at: string;
}

export interface DbTournament {
  id: string;
  slug: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  is_public: boolean;
  is_featured: boolean;
  owner_id: string;
  config: Record<string, unknown>;
  starts_at: string | null;
  ends_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTournamentAdmin {
  tournament_id: string;
  admin_id: string;
  role: AdminRole;
  created_at: string;
}

export interface DbTeam {
  id: string;
  tournament_id: string;
  global_team_id: string | null;
  name: string;
  logo_url: string | null;
  region: string | null;
  rating: number | null;
  seed: number | null;
  group_label: string | null;
  created_at: string;
}

export interface DbPlayer {
  id: string;
  tournament_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  rating: number | null;
  created_at: string;
}

export interface DbTeamMember {
  team_id: string;
  player_id: string;
  role: string | null;
}

export interface DbMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  bracket: BracketSection;
  group_label: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number;
  score_b: number;
  winner_team_id: string | null;
  status: MatchStatus;
  series_format: SeriesFormat;
  next_win_match_id: string | null;
  next_loss_match_id: string | null;
  scheduled_at: string | null;
  updated_at: string;
  updated_by: string | null;
  referee_token: string | null;
}

export interface DbMatchSet {
  id: string;
  match_id: string;
  set_number: number;
  score_a: number;
  score_b: number;
  winner_team_id: string | null;
}

export interface DbAuditLog {
  id: number;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

export interface DbQuickBracket {
  code: string;
  data: Record<string, unknown>;
  format: TournamentFormat;
  team_count: number;
  view_count: number;
  created_at: string;
  expires_at: string;
}

export interface DbUserBan {
  user_id: string;
  reason: string;
  banned_until: string | null;
  banned_by: string | null;
  created_at: string;
}

export interface DbSiteSetting {
  key: string;
  value: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
}
