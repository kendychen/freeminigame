import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { createServiceClient } from "@/lib/supabase/service";

const idGen = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

interface JoinBody {
  name: string;
}

interface Participant {
  id: string;
  name: string;
  joinedAt: number;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  let body: JoinBody;
  try {
    body = (await req.json()) as JoinBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name || name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  let sb;
  try {
    sb = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "backend_unconfigured" },
      { status: 503 },
    );
  }

  const { data: session, error: fetchErr } = await sb
    .from("pair_sessions")
    .select("participants, status, expires_at")
    .eq("code", code)
    .maybeSingle();
  if (fetchErr || !session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  if (session.status === "locked") {
    return NextResponse.json({ error: "locked" }, { status: 409 });
  }

  const participants = (session.participants as Participant[]) ?? [];
  if (participants.length >= 200) {
    return NextResponse.json({ error: "session_full" }, { status: 409 });
  }
  if (
    participants.some(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    return NextResponse.json(
      { error: "name_taken" },
      { status: 409 },
    );
  }

  const newParticipant: Participant = {
    id: idGen(),
    name,
    joinedAt: Date.now(),
  };
  const next = [...participants, newParticipant];

  const { error: updErr } = await sb
    .from("pair_sessions")
    .update({ participants: next })
    .eq("code", code);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  return NextResponse.json({ participant: newParticipant });
}
