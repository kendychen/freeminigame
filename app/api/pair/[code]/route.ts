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
      "code, title, status, group_size, participants, result, shuffle_count, created_at, expires_at, shuffled_at, shuffling_until, linked_tournament_id, team_id_map, player_id_map",
    )
    .eq("code", code)
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  // For group-draw lobbies, attach the underlying members of each team so the
  // viewer can see "Đội 1 — Nguyễn A · Trần B" instead of just "Đội 1".
  let participantMembers: Record<string, string[]> = {};
  const teamIdMap = data.team_id_map as Record<string, string> | null;
  if (teamIdMap && Object.keys(teamIdMap).length > 0) {
    const teamIds = Array.from(new Set(Object.values(teamIdMap)));
    const { data: rows } = await sb
      .from("team_members")
      .select("team_id, players(id, name)")
      .in("team_id", teamIds);
    type R = {
      team_id: string;
      players:
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null;
    };
    const namesByTeam: Record<string, string[]> = {};
    for (const r of (rows ?? []) as R[]) {
      const arr = namesByTeam[r.team_id] ?? [];
      const p = Array.isArray(r.players) ? r.players[0] : r.players;
      if (p) arr.push(p.name);
      namesByTeam[r.team_id] = arr;
    }
    for (const [participantId, teamId] of Object.entries(teamIdMap)) {
      const names = namesByTeam[teamId];
      if (names && names.length > 0) participantMembers[participantId] = names;
    }
  }

  return NextResponse.json(
    { ...data, participantMembers },
    { headers: { "Cache-Control": "no-store" } },
  );
}
