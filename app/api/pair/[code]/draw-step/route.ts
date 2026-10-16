import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { PairParticipant, PairResult } from "@/lib/pair/shuffle";
import {
  drawNextGroup,
  drawAllRemaining,
  toPairResult,
  type StepDrawState,
} from "@/lib/pair/step-draw";
import { applyPairResultToTournament } from "@/lib/pair/apply-draw";

export const maxDuration = 15;

interface StepBody {
  hostToken: string;
  /** "one" = quay 1 nhóm, "all" = phát ra tất phần còn lại. */
  action?: "one" | "all";
  spinDurationMs?: number;
}

const DEFAULT_SPIN_MS = 4000;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  let body: StepBody;
  try {
    body = (await req.json()) as StepBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.hostToken) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }
  const action = body.action === "all" ? "all" : "one";
  const spinMs = Math.max(
    800,
    Math.min(10000, body.spinDurationMs ?? DEFAULT_SPIN_MS),
  );

  const sb = createServiceClient();
  const { data: session, error } = await sb
    .from("pair_sessions")
    .select(
      "host_token, status, group_size, participants, result, shuffle_count, expires_at, draw_complete, linked_tournament_id, team_id_map, player_id_map, team_name_pattern",
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
    return NextResponse.json({ error: "already_shuffling" }, { status: 409 });
  }
  if (session.status === "closed") {
    return NextResponse.json({ error: "closed" }, { status: 409 });
  }
  if (session.draw_complete) {
    return NextResponse.json({ error: "draw_complete" }, { status: 409 });
  }

  const participants = session.participants as PairParticipant[];
  const groupSize = session.group_size as number;
  if (participants.length < groupSize) {
    return NextResponse.json({ error: "need_more_players" }, { status: 400 });
  }

  const prev = (session.result as PairResult | null) ?? null;
  const state: StepDrawState = {
    groups: prev?.groups ?? [],
    byes: prev?.byes ?? [],
  };

  // Phase 1: chốt danh sách + báo "đang quay" cho mọi màn hình.
  // Guard theo status đã đọc: nếu có ai pin/join/shuffle xen vào thì update
  // khớp 0 dòng và ta dừng, không bốc trên danh sách cũ.
  const shufflingUntil = new Date(Date.now() + spinMs).toISOString();
  const { data: phase1, error: err1 } = await sb
    .from("pair_sessions")
    .update({ status: "shuffling", shuffling_until: shufflingUntil })
    .eq("code", code)
    .eq("status", session.status)
    .select("code");
  if (err1) {
    return NextResponse.json({ error: err1.message }, { status: 500 });
  }
  if (!phase1 || phase1.length === 0) {
    return NextResponse.json({ error: "already_shuffling" }, { status: 409 });
  }

  // Bốc SAU khi đã chốt danh sách, nên không ai join/leave kịp làm lệch kết quả.
  const seed = (Date.now() ^ (state.groups.length * 2654435761)) >>> 0;
  let next: StepDrawState;
  let lastGroup: { index: number; ids: string[]; fromPin: boolean } | null = null;
  let complete: boolean;

  if (action === "all") {
    const res = drawAllRemaining(participants, groupSize, state, seed);
    next = res.next;
    complete = true;
    // "Phát ra tất" công bố nhiều nhóm cùng lúc, nên không có một "nhóm vừa
    // quay" nào đại diện. Để null để banner tắt và cả bảng kết quả hiện ra,
    // thay vì nêu đúng nhóm cuối như thể chỉ quay được 1 cặp.
    lastGroup = null;
  } else {
    const res = drawNextGroup(participants, groupSize, state, seed);
    next = res.next;
    complete = res.done;
    if (res.group) {
      lastGroup = {
        index: next.groups.length - 1,
        ids: res.group,
        fromPin: res.fromPin,
      };
    }
  }

  await new Promise((r) => setTimeout(r, spinMs));

  const round = (session.shuffle_count as number) + 1;
  const result = toPairResult(next, round);

  const { error: err2 } = await sb
    .from("pair_sessions")
    .update({
      status: complete ? "shuffled" : "lobby",
      result,
      last_group: lastGroup,
      draw_complete: complete,
      shuffle_count: round,
      shuffled_at: new Date().toISOString(),
      shuffling_until: null,
    })
    .eq("code", code);
  if (err2) {
    return NextResponse.json({ error: err2.message }, { status: 500 });
  }

  // Chỉ áp lên giải khi đã quay xong hết, tránh tạo đội/bracket nửa vời.
  if (complete) {
    const s = session as {
      linked_tournament_id?: string | null;
      team_id_map?: Record<string, string> | null;
      player_id_map?: Record<string, string> | null;
      team_name_pattern?: string | null;
    };
    try {
      await applyPairResultToTournament(
        sb,
        {
          linkedTournamentId: s.linked_tournament_id ?? null,
          teamIdMap: s.team_id_map ?? null,
          playerIdMap: s.player_id_map ?? null,
          teamNamePattern: s.team_name_pattern ?? null,
        },
        result,
      );
    } catch (e) {
      console.error("step-draw apply failed:", e);
    }
  }

  return NextResponse.json({
    result,
    lastGroup,
    complete,
    round,
    spinMs,
  });
}
