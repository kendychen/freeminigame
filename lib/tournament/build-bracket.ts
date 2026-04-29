import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Match,
  Team,
  TournamentFormat,
} from "@/lib/pairing/types";
import { generateSingleElim } from "@/lib/pairing/single-elim";
import { generateDoubleElim } from "@/lib/pairing/double-elim";
import { generateRoundRobin } from "@/lib/pairing/round-robin";
import {
  buildSwissHistory,
  generateSwissRound,
} from "@/lib/pairing/swiss";
import {
  generateGroupKnockout,
  snakeSeedGroups,
} from "@/lib/pairing/group-knockout";

export interface BuildBracketInput {
  tournamentId: string;
  format: TournamentFormat;
  seriesFormat?: "bo1" | "bo3" | "bo5";
  doubleRound?: boolean;
  groupSize?: number;
  qualifyPerGroup?: number;
}

export interface BuildBracketResult {
  ok: boolean;
  count?: number;
  error?: string;
  skipped?: "already_generated" | "not_enough_teams";
}

interface DbMatchRow {
  tournament_id: string;
  round: number;
  match_number: number;
  bracket: Match["bracket"];
  group_label: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  status: Match["status"];
  series_format: "bo1" | "bo3" | "bo5";
}

interface DbTeamRow {
  id: string;
  name: string;
  seed: number | null;
  rating: number | null;
  region: string | null;
  group_label: string | null;
}

/**
 * Generate bracket for a tournament. Idempotent — returns skipped if matches already exist.
 * Works with any SupabaseClient (user auth client OR service role).
 */
export async function buildBracket(
  supabase: SupabaseClient,
  input: BuildBracketInput,
): Promise<BuildBracketResult> {
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", input.tournamentId);
  if ((count ?? 0) > 0) {
    return { ok: false, skipped: "already_generated" };
  }

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, seed, rating, region, group_label")
    .eq("tournament_id", input.tournamentId)
    .order("seed", { ascending: true, nullsFirst: false });

  const teams: Team[] = (teamRows ?? []).map((t: DbTeamRow) => ({
    id: t.id,
    name: t.name,
    seed: t.seed ?? undefined,
    rating: t.rating ?? undefined,
    region: t.region ?? undefined,
  }));
  if (teams.length < 2) {
    return { ok: false, skipped: "not_enough_teams" };
  }

  const seriesFormat = input.seriesFormat ?? "bo1";
  let matches: Match[] = [];

  switch (input.format) {
    case "single_elim":
      matches = generateSingleElim(teams);
      break;
    case "double_elim":
      matches = generateDoubleElim(teams);
      break;
    case "round_robin":
      matches = generateRoundRobin(teams, {
        doubleRound: input.doubleRound ?? false,
      });
      break;
    case "swiss": {
      const history = buildSwissHistory(teams, []);
      matches = generateSwissRound(teams, history, 1);
      break;
    }
    case "group_knockout": {
      // Use pre-assigned group_labels if any team has them set
      const labelsSet = (teamRows ?? [])
        .map((t: DbTeamRow) => t.group_label)
        .filter((l: string | null): l is string => l !== null);
      const hasAssignments = labelsSet.length > 0;

      if (hasAssignments) {
        const grouped = new Map<string, Team[]>();
        for (const row of (teamRows ?? []) as DbTeamRow[]) {
          if (!row.group_label) continue;
          const team: Team = {
            id: row.id,
            name: row.name,
            seed: row.seed ?? undefined,
            rating: row.rating ?? undefined,
            region: row.region ?? undefined,
          };
          const arr = grouped.get(row.group_label) ?? [];
          arr.push(team);
          grouped.set(row.group_label, arr);
        }
        const all: Match[] = [];
        for (const [label, list] of grouped) {
          if (list.length < 2) continue;
          all.push(
            ...generateRoundRobin(list, {
              doubleRound: input.doubleRound,
              bracket: "group",
              groupLabel: label,
            }),
          );
        }
        matches = all;
      } else {
        // Fallback: snake-seed
        const result = generateGroupKnockout(teams, {
          groupSize: input.groupSize ?? 4,
          qualifyPerGroup: input.qualifyPerGroup ?? 2,
          doubleRound: input.doubleRound ?? false,
        });
        const all: Match[] = [];
        for (const ms of result.groups.values()) all.push(...ms);
        matches = all;

        // Also persist snake-seed assignments back to teams.group_label
        for (const [label, group] of result.groupAssignments) {
          for (const team of group) {
            await supabase
              .from("teams")
              .update({ group_label: label })
              .eq("id", team.id);
          }
        }
      }
      break;
    }
  }

  const rows: DbMatchRow[] = matches.map((m) => ({
    tournament_id: input.tournamentId,
    round: m.round,
    match_number: m.matchNumber,
    bracket: m.bracket,
    group_label: m.groupLabel ?? null,
    team_a_id: m.teamA,
    team_b_id: m.teamB,
    status: m.status,
    series_format: seriesFormat,
  }));

  const { data: inserted, error } = await supabase
    .from("matches")
    .insert(rows)
    .select("id, round, match_number, bracket, group_label");
  if (error) return { ok: false, error: error.message };

  // Phase B: link next_win_match_id / next_loss_match_id
  const idMap = new Map<string, string>();
  for (const r of (inserted ?? []) as Array<{
    id: string;
    round: number;
    match_number: number;
    bracket: string;
    group_label: string | null;
  }>) {
    const key = matchKey(r.bracket, r.round, r.match_number, r.group_label);
    idMap.set(key, r.id);
  }
  for (const m of matches) {
    const id = idMap.get(
      matchKey(m.bracket, m.round, m.matchNumber, m.groupLabel ?? null),
    );
    if (!id) continue;
    if (m.nextWinId || m.nextLossId) {
      await supabase
        .from("matches")
        .update({
          next_win_match_id: m.nextWinId ?? null,
          next_loss_match_id: m.nextLossId ?? null,
        })
        .eq("id", id);
    }
  }

  await supabase
    .from("tournaments")
    .update({ status: "running" })
    .eq("id", input.tournamentId);

  // Suppress unused import warning (snakeSeedGroups still re-exported by index)
  void snakeSeedGroups;

  return { ok: true, count: rows.length };
}

function matchKey(
  bracket: string,
  round: number,
  matchNumber: number,
  groupLabel: string | null,
): string {
  return groupLabel
    ? `${bracket}:${groupLabel}:r${round}:m${matchNumber}`
    : `${bracket}:r${round}:m${matchNumber}`;
}
