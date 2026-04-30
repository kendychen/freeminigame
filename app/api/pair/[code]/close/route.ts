import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

interface CloseBody {
  hostToken: string;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  let body: CloseBody;
  try {
    body = (await req.json()) as CloseBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: session } = await sb
    .from("pair_sessions")
    .select("host_token")
    .eq("code", code)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (session.host_token !== body.hostToken) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await sb
    .from("pair_sessions")
    .update({ status: "closed" })
    .eq("code", code);
  return NextResponse.json({ ok: true });
}
