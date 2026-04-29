import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  let sb;
  try {
    sb = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "backend_unconfigured" },
      { status: 503 },
    );
  }
  const { data, error } = await sb
    .from("pair_sessions")
    .select(
      "code, title, status, group_size, participants, result, shuffle_count, created_at, expires_at, shuffled_at",
    )
    .eq("code", code)
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
