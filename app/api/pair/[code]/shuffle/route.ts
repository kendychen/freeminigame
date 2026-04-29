import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { shuffleParticipants, type PairParticipant } from "@/lib/pair/shuffle";

interface ShuffleBody {
  hostToken: string;
}

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

  const sb = createServiceClient();
  const { data: session, error } = await sb
    .from("pair_sessions")
    .select("host_token, status, group_size, participants, shuffle_count, expires_at")
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
  // Note: shuffle ALLOWED even when status='locked' (locked just means no new joins)
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

  const { error: updErr } = await sb
    .from("pair_sessions")
    .update({
      result,
      status: "shuffled",
      shuffle_count: round,
      shuffled_at: new Date().toISOString(),
    })
    .eq("code", code);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  return NextResponse.json({ result, round });
}
