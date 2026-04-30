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

export async function setPlayerTag(input: {
  tournamentId: string;
  playerId: string;
  tag: string | null;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const cleaned = input.tag?.trim() ? input.tag.trim().slice(0, 24) : null;
  const { error } = await supabase
    .from("players")
    .update({ seed_tag: cleaned })
    .eq("id", input.playerId)
    .eq("tournament_id", input.tournamentId);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

export async function bulkSetPlayerTags(input: {
  tournamentId: string;
  assignments: Array<{ playerId: string; tag: string | null }>;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  for (const a of input.assignments) {
    const cleaned = a.tag?.trim() ? a.tag.trim().slice(0, 24) : null;
    const { error } = await supabase
      .from("players")
      .update({ seed_tag: cleaned })
      .eq("id", a.playerId)
      .eq("tournament_id", input.tournamentId);
    if (error) return { error: error.message } as const;
  }
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
  drawMode?: "random_all" | "balanced_by_tag";
}) {
  const teamSize = Math.max(2, Math.min(20, input.teamSize));
  const { supabase } = await requireTournamentAdmin(input.tournamentId);

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("id", input.tournamentId)
    .single();
  if (!tournament) return { error: "tournament_not_found" } as const;

  // Lock: refuse if any alive pair_session already linked to this tournament
  const svcCheck = createServiceClient();
  const { data: existingSession } = await svcCheck
    .from("pair_sessions")
    .select("code, host_token, status")
    .eq("linked_tournament_id", input.tournamentId)
    .gte("expires_at", new Date().toISOString())
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1);
  if (existingSession && existingSession.length > 0 && existingSession[0]) {
    return {
      error: "draw_in_progress",
      existingCode: existingSession[0].code,
      existingHostToken: existingSession[0].host_token,
    } as const;
  }

  const { data: players } = await supabase
    .from("players")
    .select("id, name, seed_tag")
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
    return {
      id: pid,
      name: p.name,
      joinedAt: Date.now(),
      tag: (p as { seed_tag?: string | null }).seed_tag ?? null,
    };
  });
  const drawMode = input.drawMode ?? "random_all";

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
      status: "lobby",
      draw_mode: drawMode,
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
