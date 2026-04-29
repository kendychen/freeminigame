import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { createServiceClient } from "@/lib/supabase/service";

const nano = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 8);

const TTL_HOURS = 72;

interface SharePayload {
  data: unknown;
  format: string;
  team_count: number;
}

export async function POST(req: Request) {
  let body: SharePayload;
  try {
    body = (await req.json()) as SharePayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    !body.format ||
    typeof body.team_count !== "number" ||
    body.team_count < 2 ||
    body.team_count > 64
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const dataStr = JSON.stringify(body.data);
  if (dataStr.length > 50000) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json({ error: "backend_unconfigured" }, { status: 503 });
  }
  let code = "";
  for (let i = 0; i < 5; i++) {
    code = nano();
    const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000);
    const { error } = await supabase.from("quick_brackets").insert({
      code,
      data: body.data,
      format: body.format,
      team_count: body.team_count,
      expires_at: expiresAt.toISOString(),
    });
    if (!error) {
      return NextResponse.json({ code, expires_at: expiresAt.toISOString() });
    }
    if (!String(error.message).includes("duplicate")) {
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "collision" }, { status: 500 });
}
