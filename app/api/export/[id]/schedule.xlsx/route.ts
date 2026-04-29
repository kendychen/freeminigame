import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildScheduleWorkbook } from "@/lib/export/xlsx";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("tournament_id", id);
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", id);
  const buf = buildScheduleWorkbook({
    tournament: t,
    teams: teams ?? [],
    matches: matches ?? [],
  });
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${t.slug}-schedule.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
