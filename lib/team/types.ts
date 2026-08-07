/** Team mode (Giải đồng đội) — typed DB rows + config. Mirrors 0032_team_events.sql. */

export type RubberCategory = "MD" | "WD" | "XD" | "FD";
export type Gender = "M" | "F";
export type TeamStage = "setup" | "group" | "knockout" | "done";
export type TieStage = "group" | "r16" | "quarterfinal" | "semifinal" | "final" | "third";

export const CATEGORY_LABELS: Record<RubberCategory, string> = {
  MD: "Đôi nam",
  WD: "Đôi nữ",
  XD: "Đôi nam nữ",
  FD: "Đôi hỗn hợp",
};

export interface TeamConfig {
  teamSize: number;
  rubbers: RubberCategory[];
  targetPoints: number;
  allowRepeatPlayer: boolean;
}

export interface DbTeamEvent {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  config: TeamConfig;
  stage: TeamStage;
  referee_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTeamSquad {
  id: string;
  event_id: string;
  name: string;
  group_label: string | null;
  seed: number;
  created_at: string;
}

export interface DbTeamPlayer {
  id: string;
  event_id: string;
  squad_id: string | null;
  name: string;
  gender: Gender;
  created_at: string;
}

export interface DbTeamTie {
  id: string;
  event_id: string;
  stage: TieStage;
  group_label: string | null;
  round: number;
  tie_no: number;
  squad_a_id: string | null;
  squad_b_id: string | null;
  rubbers_won_a: number;
  rubbers_won_b: number;
  winner_squad_id: string | null;
  status: "pending" | "completed";
  created_at: string;
  updated_at: string;
}

export interface DbTeamRubber {
  id: string;
  tie_id: string;
  event_id: string;
  rubber_no: number;
  category: RubberCategory;
  a1_id: string | null;
  a2_id: string | null;
  b1_id: string | null;
  b2_id: string | null;
  score_a: number;
  score_b: number;
  status: "pending" | "completed" | "walkover";
  walkover_winner: "a" | "b" | null;
  updated_at: string;
}

export interface TeamEventFull {
  event: DbTeamEvent;
  squads: DbTeamSquad[];
  players: DbTeamPlayer[];
  ties: DbTeamTie[];
  rubbers: DbTeamRubber[];
  refereeToken: string | null;
}
