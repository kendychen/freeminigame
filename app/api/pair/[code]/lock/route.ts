import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

interface LockBody {
  hostToken: string;
  locked?: boolean; // true = lock, false = reopen
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  let body: LockBody;
  try {
    body = (await req.json()) as LockBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: session } = await sb
    .from("pair_sessions")
    .select("host_token, status")
    .eq("code", code)
    .maybeSingle();
  if (!session)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.host_token !== body.hostToken) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const nextStatus = body.locked === false
    ? (session.status === "shuffled" ? "shuffled" : "lobby")
    : "locked";
  await sb
    .from("pair_sessions")
    .update({ status: nextStatus })
    .eq("code", code);
  return NextResponse.json({ status: nextStatus });
}
