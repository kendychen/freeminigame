import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { PairParticipant } from "@/lib/pair/shuffle";

interface PinBody {
  hostToken: string;
  /** Participant ids to pin together (2..groupSize). */
  ids?: string[];
  /** Pin group id to release. */
  unpin?: string;
}

const newPinId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `pin-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  let body: PinBody;
  try {
    body = (await req.json()) as PinBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.hostToken) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: session } = await sb
    .from("pair_sessions")
    .select("host_token, status, group_size, participants, expires_at")
    .eq("code", code)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (session.host_token !== body.hostToken) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  if (session.status !== "lobby" && session.status !== "locked") {
    return NextResponse.json({ error: "pin_stage_over" }, { status: 409 });
  }

  const participants = (session.participants as PairParticipant[]) ?? [];
  const groupSize = session.group_size as number;

  if (body.unpin) {
    const target = body.unpin;
    const hit = participants.some((p) => p.pin === target);
    if (!hit) {
      return NextResponse.json({ error: "pin_not_found" }, { status: 404 });
    }
    const next = participants.map((p) =>
      p.pin === target ? { ...p, pin: null } : p,
    );
    const { data: written, error } = await sb
      .from("pair_sessions")
      .update({ participants: next })
      .eq("code", code)
      .eq("status", session.status)
      .select("code");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // The draw may have started between the read and this write — the status
    // guard makes that a no-op instead of a pin silently lost in the spin.
    if (!written || written.length === 0) {
      return NextResponse.json({ error: "pin_stage_over" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, participants: next });
  }

  const ids = body.ids ?? [];
  const unique = Array.from(new Set(ids));
  if (unique.length !== ids.length) {
    return NextResponse.json({ error: "pin_duplicate_ids" }, { status: 400 });
  }
  if (unique.length < 2 || unique.length > groupSize) {
    return NextResponse.json({ error: "pin_invalid_size" }, { status: 400 });
  }
  const selected = unique.map((id) => participants.find((p) => p.id === id));
  if (selected.some((p) => !p)) {
    return NextResponse.json({ error: "pin_unknown_member" }, { status: 400 });
  }
  if (selected.some((p) => ((p!.pin ?? "").trim() ? true : false))) {
    return NextResponse.json({ error: "pin_already_pinned" }, { status: 409 });
  }

  const pin = newPinId();
  const idSet = new Set(unique);
  const next = participants.map((p) => (idSet.has(p.id) ? { ...p, pin } : p));
  const { data: written, error } = await sb
    .from("pair_sessions")
    .update({ participants: next })
    .eq("code", code)
    .eq("status", session.status)
    .select("code");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!written || written.length === 0) {
    return NextResponse.json({ error: "pin_stage_over" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, pin, participants: next });
}
