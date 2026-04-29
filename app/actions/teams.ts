"use server";

import { revalidatePath } from "next/cache";
import { requireTournamentAdmin } from "@/lib/auth";

export interface AddTeamInput {
  tournamentId: string;
  name: string;
  region?: string;
  rating?: number;
  logoUrl?: string;
}

export async function addTeam(input: AddTeamInput) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const { error } = await supabase.from("teams").insert({
    tournament_id: input.tournamentId,
    name: input.name,
    region: input.region ?? null,
    rating: input.rating ?? null,
    logo_url: input.logoUrl ?? null,
  });
  if (error) return { error: error.message } as const;
  revalidatePath(`/t/[slug]/admin/teams`, "page");
  return { ok: true } as const;
}

export async function updateTeam(input: {
  id: string;
  tournamentId: string;
  name?: string;
  region?: string | null;
  rating?: number | null;
  logoUrl?: string | null;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.region !== undefined) patch.region = input.region;
  if (input.rating !== undefined) patch.rating = input.rating;
  if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
  const { error } = await supabase.from("teams").update(patch).eq("id", input.id);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

export async function deleteTeam(input: { id: string; tournamentId: string }) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const { error } = await supabase.from("teams").delete().eq("id", input.id);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

export async function bulkImportTeams(input: {
  tournamentId: string;
  rows: Array<{ name: string; region?: string; rating?: number }>;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const payload = input.rows
    .filter((r) => r.name && r.name.trim())
    .slice(0, 64)
    .map((r) => ({
      tournament_id: input.tournamentId,
      name: r.name.trim(),
      region: r.region ?? null,
      rating: r.rating ?? null,
    }));
  if (!payload.length) return { ok: true, count: 0 } as const;
  const { error } = await supabase.from("teams").insert(payload);
  if (error) return { error: error.message } as const;
  return { ok: true, count: payload.length } as const;
}
