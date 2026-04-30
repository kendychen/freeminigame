"use server";

import { revalidatePath } from "next/cache";
import { requireTournamentAdmin } from "@/lib/auth";
import type { Match, Team, TournamentFormat } from "@/lib/pairing/types";
import { generateRoundRobin } from "@/lib/pairing/round-robin";
import {
  buildSwissHistory,
  generateSwissRound,
} from "@/lib/pairing/swiss";
import { promoteToKnockout } from "@/lib/pairing/group-knockout";
import { computeStandings } from "@/lib/standings/compute";
import { buildBracket } from "@/lib/tournament/build-bracket";

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
  const result = await buildBracket(supabase, input);
  if (result.skipped === "already_generated") {
    return { error: "already_generated" } as const;
  }
  if (result.skipped === "not_enough_teams") {
    return { error: "not_enough_teams" } as const;
  }
  if (!result.ok) {
    return { error: result.error ?? "build_failed" } as const;
  }

  revalidatePath(`/t`, "layout");
  return { ok: true, count: result.count ?? 0 } as const;
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
  const cfg = (t?.config ?? {}) as {
    qualifyPerGroup?: number;
    qualifyPlatePerGroup?: number;
    plateEnabled?: boolean;
  };
  const qualifyPerGroup = cfg.qualifyPerGroup ?? 2;
  const plateEnabled = !!cfg.plateEnabled;
  const qualifyPlatePerGroup = plateEnabled
    ? Math.max(0, cfg.qualifyPlatePerGroup ?? 1)
    : 0;

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

  // Already promoted? (check main OR plate)
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", input.tournamentId)
    .in("bracket", ["main", "plate"]);
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
  const mainByGroup = new Map<string, Team[]>();
  const plateByGroup = new Map<string, Team[]>();
  for (const [label, gTeams] of groups.entries()) {
    const standings = computeStandings({
      teams: gTeams,
      matches: groupMatches,
      groupLabel: label,
      randomSeed: 42,
    });
    const ordered = standings
      .map((s) => teams.find((x) => x.id === s.teamId))
      .filter((x): x is Team => !!x);
    mainByGroup.set(label, ordered.slice(0, qualifyPerGroup));
    if (qualifyPlatePerGroup > 0) {
      plateByGroup.set(
        label,
        ordered.slice(
          qualifyPerGroup,
          qualifyPerGroup + qualifyPlatePerGroup,
        ),
      );
    }
  }

  const mainKO = promoteToKnockout(mainByGroup, "main");
  const plateKO = qualifyPlatePerGroup > 0
    ? promoteToKnockout(plateByGroup, "plate")
    : [];
  const allKO = [...mainKO, ...plateKO];

  if (allKO.length === 0) return { error: "not_enough_teams" } as const;

  const rows = toDbRows(input.tournamentId, allKO, "bo1");

  // Phase A: insert without next_*_match_id (UUIDs not yet known).
  const { data: inserted, error } = await supabase
    .from("matches")
    .insert(rows)
    .select("id, round, match_number, bracket, group_label");
  if (error) return { error: error.message } as const;

  // Phase B: map nextWinId key strings → UUIDs and link.
  const idMap = new Map<string, string>();
  for (const r of (inserted ?? []) as Array<{
    id: string;
    round: number;
    match_number: number;
    bracket: string;
    group_label: string | null;
  }>) {
    const key = r.group_label
      ? `${r.bracket}:${r.group_label}:r${r.round}:m${r.match_number}`
      : `${r.bracket}:r${r.round}:m${r.match_number}`;
    idMap.set(key, r.id);
  }
  for (const m of allKO) {
    const selfKey = m.groupLabel
      ? `${m.bracket}:${m.groupLabel}:r${m.round}:m${m.matchNumber}`
      : `${m.bracket}:r${m.round}:m${m.matchNumber}`;
    const id = idMap.get(selfKey);
    if (!id) continue;
    const nextWinUuid = m.nextWinId ? (idMap.get(m.nextWinId) ?? null) : null;
    const nextLossUuid = m.nextLossId
      ? (idMap.get(m.nextLossId) ?? null)
      : null;
    if (nextWinUuid || nextLossUuid) {
      await supabase
        .from("matches")
        .update({
          next_win_match_id: nextWinUuid,
          next_loss_match_id: nextLossUuid,
        })
        .eq("id", id);
    }
  }

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
