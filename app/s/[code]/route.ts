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
    return NextResponse.json({ error: "backend_unconfigured" }, { status: 503 });
  }
  const { data } = await sb
    .from("short_urls")
    .select("tournament_id, tournaments(slug)")
    .eq("code", code)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = data.tournaments as { slug: string } | { slug: string }[] | null;
  const slug = Array.isArray(t) ? t[0]?.slug : t?.slug;
  if (!slug) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.redirect(new URL(`/t/${slug}`, "https://hoinhompick.team"), 302);
}
