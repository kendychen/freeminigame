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
  // Tên đội hiện ở bảng admin, bảng đấu và nhánh đấu, nên phải xoá cache
  // trang thay vì chỉ dựa vào state phía client của người vừa sửa.
  revalidatePath(`/t/[slug]/admin/teams`, "page");
  return { ok: true } as const;
}

export async function deleteTeam(input: { id: string; tournamentId: string }) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const { error } = await supabase.from("teams").delete().eq("id", input.id);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

/**
 * Thêm một thành viên vào đội đã có.
 *
 * `team_members.player_id` là NOT NULL + FK sang `players`, nên thành viên bắt
 * buộc là một người đã có trong tab Thành viên — không nhập được tên tự do.
 * Cả team và player đều được kiểm tra thuộc đúng giải trước khi ghi, vì
 * `requireTournamentAdmin` chỉ xác thực quyền trên giải, không xác thực rằng
 * hai id kia thuộc giải đó.
 */
export async function addTeamMember(input: {
  tournamentId: string;
  teamId: string;
  playerId: string;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", input.teamId)
    .eq("tournament_id", input.tournamentId)
    .maybeSingle();
  if (!team) return { error: "team_not_found" } as const;

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("id", input.playerId)
    .eq("tournament_id", input.tournamentId)
    .maybeSingle();
  if (!player) return { error: "player_not_found" } as const;

  const { error } = await supabase
    .from("team_members")
    .insert({ team_id: input.teamId, player_id: input.playerId });
  if (error) {
    // PK (team_id, player_id) → trùng nghĩa là đã ở trong đội này rồi.
    if (error.code === "23505") return { error: "already_member" } as const;
    return { error: error.message } as const;
  }
  revalidatePath(`/t/[slug]/admin/teams`, "page");
  return { ok: true } as const;
}

export async function removeTeamMember(input: {
  tournamentId: string;
  teamId: string;
  playerId: string;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", input.teamId)
    .eq("tournament_id", input.tournamentId)
    .maybeSingle();
  if (!team) return { error: "team_not_found" } as const;

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", input.teamId)
    .eq("player_id", input.playerId);
  if (error) return { error: error.message } as const;
  revalidatePath(`/t/[slug]/admin/teams`, "page");
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
