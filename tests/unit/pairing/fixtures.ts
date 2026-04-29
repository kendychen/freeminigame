import type { Team } from "@/lib/pairing/types";

export const makeTeams = (n: number): Team[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));

export const makeTeamsWithRegions = (n: number, regions: string[]): Team[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
    region: regions[i % regions.length],
  }));
