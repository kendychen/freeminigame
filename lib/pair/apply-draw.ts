import type { SupabaseClient } from "@supabase/supabase-js";
import type { PairResult } from "@/lib/pair/shuffle";
import { buildBracket } from "@/lib/tournament/build-bracket";
import type { TournamentFormat } from "@/lib/pairing/types";

export interface ApplyTarget {
  linkedTournamentId: string | null;
  teamIdMap: Record<string, string> | null;
  playerIdMap: Record<string, string> | null;
  teamNamePattern: string | null;
}

export interface ApplyOutcome {
  mode: "group" | "team" | "none";
  teamsCreated: number;
  groupsAssigned: number;
  already: boolean;
}

/**
 * Áp kết quả bốc thăm lên giải đã liên kết.
 *
 * Mode A (team_id_map): gán teams.group_label theo nhóm rồi build bracket.
 * Mode B (player_id_map): tạo 1 đội cho mỗi nhóm kèm thành viên; bỏ qua nếu
 * giải đã có đội (idempotent).
 */
export async function applyPairResultToTournament(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: SupabaseClient<any, any, any>,
  target: ApplyTarget,
  result: PairResult,
): Promise<ApplyOutcome> {
  const out: ApplyOutcome = {
    mode: "none",
    teamsCreated: 0,
    groupsAssigned: 0,
    already: false,
  };
  const linkedId = target.linkedTournamentId;
  if (!linkedId) return out;

  if (target.teamIdMap) {
    out.mode = "group";
    const teamIdMap = target.teamIdMap;
    const labels = "ABCDEFGHIJKLMNOP";
    const updatesByLabel = new Map<string | null, string[]>();
    for (let gi = 0; gi < result.groups.length; gi++) {
      const label = labels[gi] ?? String(gi + 1);
      const ids: string[] = [];
      for (const pid of result.groups[gi]!) {
        const teamId = teamIdMap[pid];
        if (teamId) ids.push(teamId);
      }
      if (ids.length > 0) updatesByLabel.set(label, ids);
    }
    const byeIds: string[] = [];
    for (const pid of result.byes) {
      const teamId = teamIdMap[pid];
      if (teamId) byeIds.push(teamId);
    }
    if (byeIds.length > 0) updatesByLabel.set(null, byeIds);

    let assigned = 0;
    await Promise.all(
      Array.from(updatesByLabel.entries()).map(async ([label, ids]) => {
        const { error } = await sb
          .from("teams")
          .update({ group_label: label })
          .in("id", ids);
        if (!error && label !== null) assigned += ids.length;
      }),
    );
    out.groupsAssigned = assigned;

    try {
      const { data: t } = await sb
        .from("tournaments")
        .select("format, config")
        .eq("id", linkedId)
        .maybeSingle();
      if (t) {
        const cfg = (t.config ?? {}) as {
          seriesFormat?: "bo1" | "bo3" | "bo5";
          doubleRound?: boolean;
          groupSize?: number;
          qualifyPerGroup?: number;
        };
        await buildBracket(sb, {
          tournamentId: linkedId,
          format: t.format as TournamentFormat,
          seriesFormat: cfg.seriesFormat,
          doubleRound: cfg.doubleRound,
          groupSize: cfg.groupSize,
          qualifyPerGroup: cfg.qualifyPerGroup,
        });
      }
    } catch (e) {
      console.error("applyPairResult: bracket build failed:", e);
    }
    return out;
  }

  if (target.playerIdMap) {
    out.mode = "team";
    const playerIdMap = target.playerIdMap;
    const { count: existing } = await sb
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", linkedId);
    if ((existing ?? 0) > 0) {
      out.already = true;
      return out;
    }
    const pattern = target.teamNamePattern ?? "Đội {n}";
    const teamRows = result.groups.map((_, gi) => ({
      tournament_id: linkedId,
      name: pattern.replace("{n}", String(gi + 1)),
      seed: gi + 1,
    }));
    const { data: createdTeams, error: teamErr } = await sb
      .from("teams")
      .insert(teamRows)
      .select("id, seed");
    if (teamErr) {
      console.error("applyPairResult: bulk team create failed:", teamErr);
      return out;
    }
    out.teamsCreated = (createdTeams ?? []).length;
    const teamIdBySeed = new Map<number, string>();
    for (const t of (createdTeams ?? []) as Array<{
      id: string;
      seed: number | null;
    }>) {
      if (t.seed != null) teamIdBySeed.set(t.seed, t.id);
    }
    const memberRows: Array<{ team_id: string; player_id: string }> = [];
    for (let gi = 0; gi < result.groups.length; gi++) {
      const teamId = teamIdBySeed.get(gi + 1);
      if (!teamId) continue;
      for (const pid of result.groups[gi]!) {
        const playerId = playerIdMap[pid];
        if (playerId) memberRows.push({ team_id: teamId, player_id: playerId });
      }
    }
    if (memberRows.length > 0) {
      const { error: memErr } = await sb
        .from("team_members")
        .insert(memberRows);
      if (memErr) console.error("applyPairResult: member insert failed:", memErr);
    }
  }
  return out;
}
