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

export interface CreateGroupDrawInput {
  tournamentId: string;
  groupSize: number;
}

export async function createTournamentGroupDraw(input: CreateGroupDrawInput) {
  const groupSize = Math.max(2, Math.min(20, input.groupSize));
  const { supabase } = await requireTournamentAdmin(input.tournamentId);

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("id", input.tournamentId)
    .single();
  if (!tournament) return { error: "tournament_not_found" } as const;

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("tournament_id", input.tournamentId)
    .order("seed", { ascending: true, nullsFirst: false });
  if (!teams || teams.length < groupSize) {
    return { error: "not_enough_teams" } as const;
  }

  const teamIdMap: Record<string, string> = {};
  const participants = teams.map((t) => {
    const pid = idGen();
    teamIdMap[pid] = t.id;
    return { id: pid, name: t.name, joinedAt: Date.now() };
  });

  const svc = createServiceClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = codeGen();
    const hostToken = tokenGen();
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);
    const { error } = await svc.from("pair_sessions").insert({
      code,
      host_token: hostToken,
      title: `${tournament.name} · Bốc thăm chia bảng`,
      group_size: groupSize,
      participants,
      team_id_map: teamIdMap,
      linked_tournament_id: input.tournamentId,
      status: "locked",
      expires_at: expiresAt.toISOString(),
    });
    if (!error) {
      revalidatePath(`/t`);
      return { code, host_token: hostToken } as const;
    }
    if (!String(error.message).toLowerCase().includes("duplicate")) {
      return { error: error.message } as const;
    }
  }
  return { error: "collision" } as const;
}

export async function clearTournamentGroups(tournamentId: string) {
  const { supabase } = await requireTournamentAdmin(tournamentId);
  const { error } = await supabase
    .from("teams")
    .update({ group_label: null })
    .eq("tournament_id", tournamentId);
  if (error) return { error: error.message } as const;
  revalidatePath(`/t`);
  return { ok: true } as const;
}

export async function manualAssignGroup(input: {
  tournamentId: string;
  teamId: string;
  groupLabel: string | null;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const { error } = await supabase
    .from("teams")
    .update({ group_label: input.groupLabel })
    .eq("id", input.teamId)
    .eq("tournament_id", input.tournamentId);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}
