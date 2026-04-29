import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  // Prevent CSV injection (=, +, -, @ prefix)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tournaments")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("tournament_id", id);
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", id)
    .order("round")
    .order("match_number");
  const teamById = new Map((teams ?? []).map((x) => [x.id, x.name]));
  const rows = ["Round,Match,Bracket,Group,TeamA,TeamB,ScoreA,ScoreB,Status"];
  for (const m of matches ?? []) {
    rows.push(
      [
        m.round,
        m.match_number,
        m.bracket,
        m.group_label ?? "",
        teamById.get(m.team_a_id ?? "") ?? "TBD",
        teamById.get(m.team_b_id ?? "") ?? "TBD",
        m.score_a,
        m.score_b,
        m.status,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return new NextResponse(rows.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${t.slug}-schedule.csv"`,
    },
  });
}
