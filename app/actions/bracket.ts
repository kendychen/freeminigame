"use server";

import { revalidatePath } from "next/cache";
import { requireTournamentAdmin } from "@/lib/auth";
import type { Match, Team, TournamentFormat } from "@/lib/pairing/types";
import { generateSingleElim } from "@/lib/pairing/single-elim";
import { generateDoubleElim } from "@/lib/pairing/double-elim";
import { generateRoundRobin } from "@/lib/pairing/round-robin";
import {
  buildSwissHistory,
  generateSwissRound,
} from "@/lib/pairing/swiss";
import {
  generateGroupKnockout,
  promoteToKnockout,
} from "@/lib/pairing/group-knockout";
import { computeStandings } from "@/lib/standings/compute";

interface DbMatchRow {
  id?: string;
  tournament_id: string;
  round: number;
  match_number: number;
  bracket: Match["bracket"];
  group_label: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  status: Match["status"];
  series_format: "bo1" | "bo3" | "bo5";
  next_win_match_id: string | null;
  next_loss_match_id: string | null;
}

function toDbRows(
  tournamentId: string,
  matches: Match[],
  seriesFormat: "bo1" | "bo3" | "bo5",
): DbMatchRow[] {
  return matches.map((m) => ({
    tournament_id: tournamentId,
    round: m.round,
    match_number: m.matchNumber,
    bracket: m.bracket,
    group_label: m.groupLabel ?? null,
    team_a_id: m.teamA,
    team_b_id: m.teamB,
    status: m.status,
    series_format: seriesFormat,
    next_win_match_id: null,
    next_loss_match_id: null,
  }));
}

export async function generateBracket(input: {
  tournamentId: string;
  format: TournamentFormat;
  seriesFormat?: "bo1" | "bo3" | "bo5";
  doubleRound?: boolean;
  groupSize?: number;
  qualifyPerGroup?: number;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);

  // Idempotency: refuse if matches already exist
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", input.tournamentId);
  if ((count ?? 0) > 0) {
    return { error: "already_generated" } as const;
  }

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, seed, rating, region")
    .eq("tournament_id", input.tournamentId)
    .order("seed", { ascending: true, nullsFirst: false });
  const teams: Team[] = (teamRows ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    seed: t.seed ?? undefined,
    rating: t.rating ?? undefined,
    region: t.region ?? undefined,
  }));
  if (teams.length < 2) return { error: "not_enough_teams" } as const;

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
      const result = generateGroupKnockout(teams, {
        groupSize: input.groupSize ?? 4,
        qualifyPerGroup: input.qualifyPerGroup ?? 2,
        doubleRound: input.doubleRound ?? false,
      });
      const all: Match[] = [];
      for (const ms of result.groups.values()) all.push(...ms);
      matches = all;
      break;
    }
  }

  const rows = toDbRows(input.tournamentId, matches, seriesFormat);
  // Phase A: insert without next_*_match_id (we don't yet have UUIDs).
  const { data: inserted, error } = await supabase
    .from("matches")
    .insert(rows)
    .select("id, round, match_number, bracket, group_label");
  if (error) return { error: error.message } as const;

  // Phase B: build idKey -> uuid map and patch next_win/loss
  const idMap = new Map<string, string>();
  for (const r of inserted ?? []) {
    const key = matchKey(r.bracket, r.round, r.match_number, r.group_label);
    idMap.set(key, r.id);
  }
  const updates: Array<{
    id: string;
    next_win_match_id: string | null;
    next_loss_match_id: string | null;
  }> = [];
  for (const m of matches) {
    const id = idMap.get(
      matchKey(m.bracket, m.round, m.matchNumber, m.groupLabel ?? null),
    );
    if (!id) continue;
    const nextWin = m.nextWinId
      ? idMap.get(remapId(m.nextWinId, matches, m.bracket)) ?? null
      : null;
    const nextLoss = m.nextLossId
      ? idMap.get(remapId(m.nextLossId, matches, "losers")) ?? null
      : null;
    updates.push({ id, next_win_match_id: nextWin, next_loss_match_id: nextLoss });
  }
  for (const u of updates) {
    await supabase
      .from("matches")
      .update({
        next_win_match_id: u.next_win_match_id,
        next_loss_match_id: u.next_loss_match_id,
      })
      .eq("id", u.id);
  }

  await supabase
    .from("tournaments")
    .update({ status: "running" })
    .eq("id", input.tournamentId);

  revalidatePath(`/t`, "layout");
  return { ok: true, count: rows.length } as const;
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

function remapId(idStr: string, _matches: Match[], _expected: string): string {
  return idStr;
}

export async function generateSwissNextRound(input: {
  tournamentId: string;
  roundNumber: number;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, region, rating, seed")
    .eq("tournament_id", input.tournamentId);
  const teams: Team[] = (teamRows ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    region: t.region ?? undefined,
    rating: t.rating ?? undefined,
    seed: t.seed ?? undefined,
  }));
  const { data: matchRows } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", input.tournamentId);
  const matches: Match[] = (matchRows ?? []).map(rowToMatch);

  // Validate previous round completed (if requested round > 1)
  if (input.roundNumber > 1) {
    const prev = matches.filter((m) => m.round === input.roundNumber - 1);
    const incomplete = prev.filter(
      (m) => m.status !== "completed" && m.status !== "bye",
    );
    if (incomplete.length > 0) {
      return { error: "previous_round_incomplete" } as const;
    }
  }
  // Refuse if requested round already exists
  if (matches.some((m) => m.round === input.roundNumber)) {
    return { error: "round_already_generated" } as const;
  }
  const history = buildSwissHistory(teams, matches);
  const next = generateSwissRound(teams, history, input.roundNumber);
  const rows = toDbRows(input.tournamentId, next, "bo1");
  const { error } = await supabase.from("matches").insert(rows);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

export async function promoteGroupQualifiers(input: { tournamentId: string }) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const { data: t } = await supabase
    .from("tournaments")
    .select("config")
    .eq("id", input.tournamentId)
    .single();
  const cfg = (t?.config ?? {}) as { qualifyPerGroup?: number };
  const qualifyPerGroup = cfg.qualifyPerGroup ?? 2;

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, seed, rating, region")
    .eq("tournament_id", input.tournamentId);
  const teams: Team[] = (teamRows ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    seed: t.seed ?? undefined,
    rating: t.rating ?? undefined,
    region: t.region ?? undefined,
  }));
  const { data: groupMatchRows } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", input.tournamentId)
    .eq("bracket", "group");
  const groupMatches: Match[] = (groupMatchRows ?? []).map(rowToMatch);

  const allCompleted = groupMatches.every(
    (m) => m.status === "completed" || m.status === "bye",
  );
  if (!allCompleted) return { error: "groups_incomplete" } as const;

  // Already promoted?
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", input.tournamentId)
    .eq("bracket", "main");
  if ((count ?? 0) > 0) return { error: "already_promoted" } as const;

  const groups = new Map<string, Team[]>();
  for (const m of groupMatches) {
    if (!m.groupLabel) continue;
    const existing = groups.get(m.groupLabel) ?? [];
    if (!existing.length) {
      const involved = teams.filter(
        (t) =>
          groupMatches.some(
            (mm) =>
              mm.groupLabel === m.groupLabel &&
              (mm.teamA === t.id || mm.teamB === t.id),
          ),
      );
      groups.set(m.groupLabel, involved);
    }
  }
  const qualifiedByGroup = new Map<string, Team[]>();
  for (const [label, gTeams] of groups.entries()) {
    const standings = computeStandings({
      teams: gTeams,
      matches: groupMatches,
      groupLabel: label,
      randomSeed: 42,
    });
    const top = standings.slice(0, qualifyPerGroup).map((s) => {
      const t = teams.find((x) => x.id === s.teamId);
      return t!;
    });
    qualifiedByGroup.set(label, top);
  }

  const knockout = promoteToKnockout(qualifiedByGroup);
  const rows = toDbRows(input.tournamentId, knockout, "bo1");
  const { error } = await supabase.from("matches").insert(rows);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

function rowToMatch(r: Record<string, unknown>): Match {
  return {
    id: r.id as string,
    round: r.round as number,
    matchNumber: r.match_number as number,
    bracket: r.bracket as Match["bracket"],
    groupLabel: (r.group_label as string | null) ?? undefined,
    teamA: r.team_a_id as string | null,
    teamB: r.team_b_id as string | null,
    scoreA: r.score_a as number,
    scoreB: r.score_b as number,
    winner: r.winner_team_id as string | null,
    status: r.status as Match["status"],
    nextWinId: (r.next_win_match_id as string | null) ?? undefined,
    nextLossId: (r.next_loss_match_id as string | null) ?? undefined,
  };
}
