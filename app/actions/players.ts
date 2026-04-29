"use server";

import { customAlphabet } from "nanoid";
import { revalidatePath } from "next/cache";
import { requireTournamentAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

const codeGen = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 6);
const tokenGen = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  32,
);
const idGen = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

export async function addPlayer(input: {
  tournamentId: string;
  name: string;
  handle?: string;
  rating?: number;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const name = input.name.trim();
  if (!name) return { error: "empty_name" } as const;
  const { error } = await supabase.from("players").insert({
    tournament_id: input.tournamentId,
    name,
    handle: input.handle ?? null,
    rating: input.rating ?? null,
  });
  if (error) return { error: error.message } as const;
  revalidatePath(`/t`);
  return { ok: true } as const;
}

export async function deletePlayer(input: {
  tournamentId: string;
  playerId: string;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", input.playerId);
  if (error) return { error: error.message } as const;
  revalidatePath(`/t`);
  return { ok: true } as const;
}

export async function bulkImportPlayers(input: {
  tournamentId: string;
  names: string[];
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const rows = input.names
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 200)
    .map((name) => ({ tournament_id: input.tournamentId, name }));
  if (!rows.length) return { ok: true, count: 0 } as const;
  const { error } = await supabase.from("players").insert(rows);
  if (error) return { error: error.message } as const;
  revalidatePath(`/t`);
  return { ok: true, count: rows.length } as const;
}

export async function clearTeamsAndMembers(tournamentId: string) {
  const { supabase } = await requireTournamentAdmin(tournamentId);
  // Delete teams (cascades to team_members + matches via FK)
  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("tournament_id", tournamentId);
  if (error) return { error: error.message } as const;
  await supabase
    .from("tournaments")
    .update({ status: "draft" })
    .eq("id", tournamentId);
  revalidatePath(`/t`);
  return { ok: true } as const;
}

/**
 * Random team draw: take all players, group them into teams via realtime
 * pair lobby. After shuffle, server creates teams and assigns members.
 */
export async function createPlayerTeamDraw(input: {
  tournamentId: string;
  teamSize: number;
  teamNamePattern?: string;
}) {
  const teamSize = Math.max(2, Math.min(20, input.teamSize));
  const { supabase } = await requireTournamentAdmin(input.tournamentId);

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("id", input.tournamentId)
    .single();
  if (!tournament) return { error: "tournament_not_found" } as const;

  const { data: players } = await supabase
    .from("players")
    .select("id, name")
    .eq("tournament_id", input.tournamentId);
  if (!players || players.length < teamSize) {
    return { error: "not_enough_players" } as const;
  }

  // Refuse if teams already exist (would conflict with draw)
  const { count: existingTeams } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", input.tournamentId);
  if ((existingTeams ?? 0) > 0) {
    return { error: "teams_exist" } as const;
  }

  const playerIdMap: Record<string, string> = {};
  const participants = players.map((p) => {
    const pid = idGen();
    playerIdMap[pid] = p.id;
    return { id: pid, name: p.name, joinedAt: Date.now() };
  });

  const svc = createServiceClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = codeGen();
    const hostToken = tokenGen();
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);
    const { error } = await svc.from("pair_sessions").insert({
      code,
      host_token: hostToken,
      title: `${tournament.name} · Bốc thăm chia đội`,
      group_size: teamSize,
      participants,
      player_id_map: playerIdMap,
      team_name_pattern: input.teamNamePattern ?? "Đội {n}",
      linked_tournament_id: input.tournamentId,
      status: "locked",
      expires_at: expiresAt.toISOString(),
    });
    if (!error) {
      return { code, host_token: hostToken } as const;
    }
    if (!String(error.message).toLowerCase().includes("duplicate")) {
      return { error: error.message } as const;
    }
  }
  return { error: "collision" } as const;
}
