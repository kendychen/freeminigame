import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

interface LeaveBody {
  participantId: string;
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
  let body: LeaveBody;
  try {
    body = (await req.json()) as LeaveBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.participantId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: session } = await sb
    .from("pair_sessions")
    .select("participants")
    .eq("code", code)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const participants = (session.participants as Participant[]) ?? [];
  const next = participants.filter((p) => p.id !== body.participantId);
  await sb.from("pair_sessions").update({ participants: next }).eq("code", code);
  return NextResponse.json({ ok: true });
}
