import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "backend_unconfigured" },
      { status: 503 },
    );
  }
  const { data, error } = await supabase
    .from("quick_brackets")
    .select("code, data, format, team_count, view_count, created_at, expires_at")
    .eq("code", code)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  // Best-effort view counter
  await supabase
    .from("quick_brackets")
    .update({ view_count: data.view_count + 1 })
    .eq("code", code);
  return NextResponse.json(data);
}
