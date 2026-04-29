import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { shuffleParticipants, type PairParticipant } from "@/lib/pair/shuffle";

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
      "host_token, status, group_size, participants, shuffle_count, expires_at, linked_tournament_id, team_id_map",
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
  const result = shuffleParticipants(
    participants,
    session.group_size,
    seed,
    round,
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

  // Auto-apply group labels to linked tournament's teams
  const linkedId = (session as { linked_tournament_id?: string })
    .linked_tournament_id;
  const teamIdMap = (
    session as { team_id_map?: Record<string, string> | null }
  ).team_id_map;
  if (linkedId && teamIdMap) {
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
  }

  return NextResponse.json({ result, round, spinMs });
}
