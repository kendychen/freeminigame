import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { createServiceClient } from "@/lib/supabase/service";

const codeGen = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 6);
const tokenGen = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  32,
);

interface CreateBody {
  title?: string;
  groupSize?: number;
  presetNames?: string[];
  lockOnCreate?: boolean;
}

interface Participant {
  id: string;
  name: string;
  joinedAt: number;
}

const idGen = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

export async function POST(req: Request) {
  let body: CreateBody = {};
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    body = {};
  }
  const groupSize = Math.max(2, Math.min(20, body.groupSize ?? 2));
  const title = (body.title?.trim() || "Bốc thăm chia cặp").slice(0, 100);

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "backend_unconfigured" },
      { status: 503 },
    );
  }

  // Build preset participants (deduped, trimmed, capped at 200)
  const presetParticipants: Participant[] = (body.presetNames ?? [])
    .map((n) => n.trim())
    .filter((n) => n.length >= 1 && n.length <= 40)
    .filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i)
    .slice(0, 200)
    .map((name) => ({ id: idGen(), name, joinedAt: Date.now() }));

  const lockOnCreate = body.lockOnCreate ?? presetParticipants.length > 0;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = codeGen();
    const hostToken = tokenGen();
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);
    const { error } = await supabase.from("pair_sessions").insert({
      code,
      host_token: hostToken,
      title,
      group_size: groupSize,
      participants: presetParticipants,
      status: lockOnCreate ? "locked" : "lobby",
      expires_at: expiresAt.toISOString(),
    });
    if (!error) {
      return NextResponse.json({
        code,
        host_token: hostToken,
        expires_at: expiresAt.toISOString(),
      });
    }
    if (!String(error.message).toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "collision" }, { status: 500 });
}
