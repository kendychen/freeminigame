import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

interface LeaveBody {
  participantId: string;
}

interface Participant {
  id: string;
  name: string;
  joinedAt: number;
  pin?: string | null;
}

/** A pin group with a single member left is meaningless — release it. */
function dropOrphanPins(participants: Participant[]): Participant[] {
  const counts = new Map<string, number>();
  for (const p of participants) {
    const pin = (p.pin ?? "").trim();
    if (pin) counts.set(pin, (counts.get(pin) ?? 0) + 1);
  }
  return participants.map((p) => {
    const pin = (p.pin ?? "").trim();
    return pin && (counts.get(pin) ?? 0) < 2 ? { ...p, pin: null } : p;
  });
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
  const removed = participants.find((p) => p.id === body.participantId);
  const remaining = participants.filter((p) => p.id !== body.participantId);
  const next = (removed?.pin ?? "").trim()
    ? dropOrphanPins(remaining)
    : remaining;
  await sb.from("pair_sessions").update({ participants: next }).eq("code", code);
  return NextResponse.json({ ok: true });
}
