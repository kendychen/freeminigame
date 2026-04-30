import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { shuffleParticipants, type PairParticipant } from "@/lib/pair/shuffle";
import { buildBracket } from "@/lib/tournament/build-bracket";
import type { TournamentFormat } from "@/lib/pairing/types";

export const maxDuration = 15;

interface ShuffleBody {
  hostToken: string;
  spinDurationMs?: number; // 5000-10000 typical
}

const DEFAULT_SPIN_MS = 7000;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  let body: ShuffleBody;
  try {
    body = (await req.json()) as ShuffleBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.hostToken) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }
  const spinMs = Math.max(
    1000,
    Math.min(10000, body.spinDurationMs ?? DEFAULT_SPIN_MS),
  );

  const sb = createServiceClient();
  const { data: session, error } = await sb
    .from("pair_sessions")
    .select(
      "host_token, status, group_size, participants, shuffle_count, expires_at, linked_tournament_id, team_id_map, player_id_map, team_name_pattern, draw_mode",
    )
    .eq("code", code)
    .maybeSingle();
  if (error || !session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (session.host_token !== body.hostToken) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  if (session.status === "shuffling") {
    return NextResponse.json(
      { error: "already_shuffling" },
      { status: 409 },
    );
  }
  if (session.shuffle_count >= 1) {
    return NextResponse.json(
      { error: "already_shuffled_once" },
      { status: 409 },
    );
  }
  const participants = session.participants as PairParticipant[];
  if (participants.length < 2) {
    return NextResponse.json(
      { error: "need_at_least_2" },
      { status: 400 },
    );
  }

  const round = session.shuffle_count + 1;
  const seed = Date.now() & 0xffffffff;
  const drawMode = ((session as { draw_mode?: string }).draw_mode ?? "random_all") as
    | "random_all"
    | "balanced_by_tag";
  const result = shuffleParticipants(
    participants,
    session.group_size,
    seed,
    round,
    drawMode,
  );

  // Phase 1: broadcast "shuffling" state — all clients show spinner.
  const shufflingUntil = new Date(Date.now() + spinMs).toISOString();
  const { error: phaseErr1 } = await sb
    .from("pair_sessions")
    .update({
      status: "shuffling",
      shuffling_until: shufflingUntil,
      result: null,
    })
    .eq("code", code);
  if (phaseErr1) {
    return NextResponse.json({ error: phaseErr1.message }, { status: 500 });
  }

  // Wait spinMs server-side (max 10s, well within 15s function limit)
  await new Promise((r) => setTimeout(r, spinMs));

  // Phase 2: reveal result.
  const { error: phaseErr2 } = await sb
    .from("pair_sessions")
    .update({
      status: "shuffled",
      result,
      shuffle_count: round,
      shuffled_at: new Date().toISOString(),
      shuffling_until: null,
    })
    .eq("code", code);
  if (phaseErr2) {
    return NextResponse.json({ error: phaseErr2.message }, { status: 500 });
  }

  // Auto-apply to linked tournament — 2 modes
  const s = session as {
    linked_tournament_id?: string;
    team_id_map?: Record<string, string> | null;
    player_id_map?: Record<string, string> | null;
    team_name_pattern?: string | null;
  };
  const linkedId = s.linked_tournament_id;
  const teamIdMap = s.team_id_map;
  const playerIdMap = s.player_id_map;

  if (linkedId && teamIdMap) {
    // Mode A: GROUP DRAW (chia bảng) — set teams.group_label + auto-generate bracket
    const labels = "ABCDEFGHIJKLMNOP";
    for (let gi = 0; gi < result.groups.length; gi++) {
      const label = labels[gi] ?? String(gi + 1);
      const groupIds = result.groups[gi]!;
      for (const pid of groupIds) {
        const teamId = teamIdMap[pid];
        if (teamId) {
          await sb
            .from("teams")
            .update({ group_label: label })
            .eq("id", teamId);
        }
      }
    }
    for (const pid of result.byes) {
      const teamId = teamIdMap[pid];
      if (teamId) {
        await sb.from("teams").update({ group_label: null }).eq("id", teamId);
      }
    }
    // Auto-generate bracket ONLY after group draw
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
      console.error("Auto-bracket after group draw failed:", e);
    }
  } else if (linkedId && playerIdMap) {
    // Mode B: TEAM DRAW (chia đội từ thành viên) — create teams + members. NO bracket.
    const pattern = s.team_name_pattern ?? "Đội {n}";
    for (let gi = 0; gi < result.groups.length; gi++) {
      const teamName = pattern.replace("{n}", String(gi + 1));
      const groupIds = result.groups[gi]!;
      const { data: createdTeam, error: teamErr } = await sb
        .from("teams")
        .insert({
          tournament_id: linkedId,
          name: teamName,
          seed: gi + 1,
        })
        .select("id")
        .single();
      if (teamErr || !createdTeam) {
        console.error("Team create failed:", teamErr);
        continue;
      }
      const memberRows = groupIds
        .map((pid) => playerIdMap[pid])
        .filter((id): id is string => !!id)
        .map((playerId) => ({
          team_id: createdTeam.id,
          player_id: playerId,
        }));
      if (memberRows.length > 0) {
        await sb.from("team_members").insert(memberRows);
      }
    }
  }

  return NextResponse.json({ result, round, spinMs });
}
