export type TournamentFormat =
  | "random_pairs"
  | "random_groups"
  | "single_elim"
  | "double_elim"
  | "round_robin"
  | "swiss"
  | "group_knockout";

export type BracketSection =
  | "main"
  | "winners"
  | "losers"
  | "grand_final"
  | "group"
  | "plate";

export interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  seed?: number;
  rating?: number;
  region?: string;
}

export interface Match {
  id: string;
  round: number;
  matchNumber: number;
  bracket: BracketSection;
  groupLabel?: string;
  teamA: string | null;
  teamB: string | null;
  scoreA: number;
  scoreB: number;
  winner: string | null;
  status: "pending" | "live" | "completed" | "bye";
  nextWinId?: string;
  nextLossId?: string;
}

export interface SeedingOptions {
  mode: "manual" | "random" | "ranking";
  seed?: number;
}

export interface AvoidConfig {
  byRegion?: boolean;
  byTeam?: boolean;
  manualPairs?: Array<[string, string]>;
}

export const matchKey = (
  bracket: BracketSection,
  round: number,
  matchNumber: number,
  groupLabel?: string,
): string =>
  groupLabel
    ? `${bracket}:${groupLabel}:r${round}:m${matchNumber}`
    : `${bracket}:r${round}:m${matchNumber}`;
