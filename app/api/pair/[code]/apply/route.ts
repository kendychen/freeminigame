import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { PairResult } from "@/lib/pair/shuffle";
import { buildBracket } from "@/lib/tournament/build-bracket";
import type { TournamentFormat } from "@/lib/pairing/types";

interface ApplyBody {
  hostToken: string;
}

/**
 * Idempotent re-apply of the latest draw result onto the linked tournament.
 *
 * Mode A (group draw / team_id_map): re-stamp teams.group_label from result.
 * Mode B (team draw / player_id_map): if no teams exist yet, create one team
 * per group with members. If teams already exist, no-op (returns ok=true,
 * already=true).
 *
 * Used as a manual safety net for hosts when the automatic post-shuffle
 * apply was missed (network blip, function timeout, etc).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.hostToken) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: session } = await sb
    .from("pair_sessions")
    .select(
      "host_token, status, result, linked_tournament_id, team_id_map, player_id_map, team_name_pattern",
    )
    .eq("code", code)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (session.host_token !== body.hostToken) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!session.result) {
    return NextResponse.json({ error: "no_result_yet" }, { status: 409 });
  }
  if (!session.linked_tournament_id) {
    return NextResponse.json({ error: "not_linked" }, { status: 409 });
  }

  const result = session.result as PairResult;
  const linkedId = session.linked_tournament_id as string;
  const teamIdMap = session.team_id_map as Record<string, string> | null;
  const playerIdMap = session.player_id_map as Record<string, string> | null;

  let mode: "group" | "team" | "none" = "none";
  let teamsCreated = 0;
  let groupsAssigned = 0;

  if (teamIdMap) {
    mode = "group";
    const labels = "ABCDEFGHIJKLMNOP";
    for (let gi = 0; gi < result.groups.length; gi++) {
      const label = labels[gi] ?? String(gi + 1);
      const groupIds = result.groups[gi]!;
      for (const pid of groupIds) {
        const teamId = teamIdMap[pid];
        if (teamId) {
          const { error } = await sb
            .from("teams")
            .update({ group_label: label })
            .eq("id", teamId);
          if (!error) groupsAssigned += 1;
        }
      }
    }
    for (const pid of result.byes) {
      const teamId = teamIdMap[pid];
      if (teamId) {
        await sb
          .from("teams")
          .update({ group_label: null })
          .eq("id", teamId);
      }
    }
    // Idempotent bracket build (skips if matches already exist)
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
      console.error("Apply: bracket build failed:", e);
    }
  } else if (playerIdMap) {
    mode = "team";
    // Idempotent: skip if teams already exist for this tournament
    const { count: existing } = await sb
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", linkedId);
    if ((existing ?? 0) > 0) {
      return NextResponse.json({
        ok: true,
        mode,
        already: true,
        teamsCreated: 0,
      });
    }
    const pattern =
      (session.team_name_pattern as string | null) ?? "Đội {n}";
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
      console.error("Apply: bulk team create failed:", teamErr);
      return NextResponse.json(
        { error: teamErr.message },
        { status: 500 },
      );
    }
    teamsCreated = (createdTeams ?? []).length;
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
      const groupIds = result.groups[gi]!;
      for (const pid of groupIds) {
        const playerId = playerIdMap[pid];
        if (playerId) memberRows.push({ team_id: teamId, player_id: playerId });
      }
    }
    if (memberRows.length > 0) {
      const { error: memErr } = await sb
        .from("team_members")
        .insert(memberRows);
      if (memErr) console.error("Apply: member insert failed:", memErr);
    }
  }

  return NextResponse.json({
    ok: true,
    mode,
    teamsCreated,
    groupsAssigned,
  });
}
