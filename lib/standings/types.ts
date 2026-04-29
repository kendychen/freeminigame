export type TieBreakerType =
  | "head_to_head"
  | "point_differential"
  | "buchholz"
  | "sonneborn_berger"
  | "auxiliary_points"
  | "random";

export interface TieBreakerConfig {
  order: number;
  type: TieBreakerType;
}

export interface Standing {
  teamId: string;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  // Per-tiebreaker scratch values
  buchholz?: number;
  sonnebornBerger?: number;
  auxPoints?: number;
}
