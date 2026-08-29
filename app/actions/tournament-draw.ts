"use server";

import { customAlphabet } from "nanoid";
import { revalidatePath } from "next/cache";
import { requireUser, requireTournamentAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  buildPairDrawPlan,
  type PinnedPair,
} from "@/lib/tournament/pair-draw-plan";

const codeGen = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 6);
const tokenGen = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  24,
);

export type TDrawMode = "group" | "slot" | "pair";

interface DrawSessionRow {
  code: string;
  tournament_id: string;
  owner_id: string;
  host_token: string;
  mode: TDrawMode;
  slot_sizes: number[];
  slot_tags: Record<string, string> | null;
  entrant_tokens: Record<string, string>;
  assignments: Record<string, { g: number; p: number; pinned?: boolean }>;
  status: string;
}

/**
 * Create a LIVE draw session with a personal link per entrant.
 * - mode 'group': entrants = teams, buckets = groups (Group + Knockout)
 * - mode 'slot':  entrants = teams, buckets = bracket positions (1 slot each)
 * - mode 'pair':  entrants = players, buckets = teams of 2 (bốc thăm ghép đôi);
 *   balancedByTag ⇒ position 1/2 locked to the 2 seed_tag values (vd Nam/Nữ)
 */
export async function createTournamentDrawSession(input: {
  tournamentId: string;
  mode: TDrawMode;
  groupCount?: number;
  teamCount?: number;
  balancedByTag?: boolean;
  /** mode "pair" only — cặp VĐV ghim sẵn vào các đội cuối danh sách */
  pinnedPairs?: PinnedPair[];
}): Promise<
  | { code: string; hostToken: string }
  | { error: string; existingCode?: string }
> {
  const { user } = await requireTournamentAdmin(input.tournamentId);
  const svc = createServiceClient();

  const { data: existing } = await svc
    .from("t_draw_sessions")
    .select("code")
    .eq("tournament_id", input.tournamentId)
    .eq("status", "active")
    .gte("expires_at", new Date().toISOString())
    .limit(1);
  if (existing && existing.length > 0) {
    return { error: "session_already_active", existingCode: existing[0]!.code };
  }

  let slotSizes: number[];
  let slotTags: Record<string, string> | null = null;
  let entrantIds: string[];
  let initialAssignments: Record<string, { g: number; p: number; pinned: true }> =
    {};

  if (input.mode === "pair") {
    // Không cần tạo đội trước — hệ tự tạo "Đội 1..N" khi xác nhận kết quả
    const { count: teamCountExisting } = await svc
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", input.tournamentId);
    if ((teamCountExisting ?? 0) > 0) return { error: "teams_exist" };

    const { data: players } = await svc
      .from("players")
      .select("id, seed_tag")
      .eq("tournament_id", input.tournamentId);
    if (!players || players.length < 4) return { error: "need_at_least_4_players" };

    // Admin chọn số đội — mặc định ghép cặp 2 người/đội; số dư rải đều (đội 3 người)
    const maxTeams = Math.floor(players.length / 2);
    const teamCount = input.teamCount ?? maxTeams;
    const plan = buildPairDrawPlan({
      players: players.map((p) => ({ id: p.id, seedTag: p.seed_tag })),
      teamCount,
      pinnedPairs: input.pinnedPairs ?? [],
      balancedByTag: !!input.balancedByTag,
    });
    if (!plan.ok) return { error: plan.error };
    slotSizes = plan.slotSizes;
    slotTags = plan.slotTags;
    initialAssignments = plan.assignments;
    entrantIds = players.map((p) => p.id);
  } else {
    const { count: matchCount } = await svc
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", input.tournamentId);
    if ((matchCount ?? 0) > 0) return { error: "already_generated" };

    const { data: teams } = await svc
      .from("teams")
      .select("id")
      .eq("tournament_id", input.tournamentId);
    if (!teams || teams.length < 2) return { error: "not_enough_teams" };
    entrantIds = teams.map((t) => t.id);

    if (input.mode === "group") {
      const n = teams.length;
      const k = input.groupCount ?? 2;
      if (k < 2 || k > Math.floor(n / 2)) return { error: "invalid_group_count" };
      const base = Math.floor(n / k);
      const extra = n % k;
      slotSizes = Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
    } else {
      slotSizes = Array.from({ length: teams.length }, () => 1);
    }
  }

  const hostToken = tokenGen();
  const entrantTokens: Record<string, string> = {};
  for (const id of entrantIds) entrantTokens[id] = tokenGen();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = codeGen();
    const { error } = await svc.from("t_draw_sessions").insert({
      code,
      tournament_id: input.tournamentId,
      owner_id: user.id,
      host_token: hostToken,
      mode: input.mode,
      slot_sizes: slotSizes,
      slot_tags: slotTags,
      entrant_tokens: entrantTokens,
      assignments: initialAssignments,
      status: "active",
    });
    if (!error) return { code, hostToken };
    if (!String(error.message).toLowerCase().includes("duplicate"))
      return { error: error.message };
  }
  return { error: "collision" };
}

/** Latest active session for admin cards (returns entrant tokens — admin only). */
export async function getActiveTournamentDraw(tournamentId: string): Promise<
  | { active: false }
  | {
      active: true;
      code: string;
      mode: TDrawMode;
      slotSizes: number[];
      entrantTokens: Record<string, string>;
      drawnCount: number;
      total: number;
    }
> {
  await requireTournamentAdmin(tournamentId);
  const svc = createServiceClient();
  const { data } = await svc
    .from("t_draw_sessions")
    .select("code, mode, slot_sizes, entrant_tokens, assignments, status")
    .eq("tournament_id", tournamentId)
    .eq("status", "active")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  const s = data?.[0];
  if (!s) return { active: false };
  const tokens = s.entrant_tokens as Record<string, string>;
  return {
    active: true,
    code: s.code,
    mode: s.mode as TDrawMode,
    slotSizes: s.slot_sizes as number[],
    entrantTokens: tokens,
    drawnCount: Object.keys((s.assignments ?? {}) as object).length,
    total: Object.keys(tokens).length,
  };
}

/** Entrant taps to draw a random empty slot. No login — token-gated (open mode if no token). */
export async function tapTournamentDraw(
  code: string,
  entrantId: string,
  entrantToken: string | null,
): Promise<{ ok: true; groupIdx: number; position: number } | { error: string }> {
  const svc = createServiceClient();

  const { data: session } = await svc
    .from("t_draw_sessions")
    .select("code, tournament_id, mode, slot_sizes, slot_tags, entrant_tokens, assignments, status")
    .eq("code", code)
    .single();
  if (!session) return { error: "session_not_found" };
  if (session.status !== "active") return { error: "session_not_active" };

  const tokens = session.entrant_tokens as Record<string, string>;
  if (!(entrantId in tokens)) return { error: "invalid_entrant" };
  if (entrantToken && tokens[entrantId] !== entrantToken)
    return { error: "invalid_token" };

  // Pair mode with tag constraint: player may only land on the position matching their tag
  let allowedP: number | null = null;
  const slotTags = session.slot_tags as Record<string, string> | null;
  if (session.mode === "pair" && slotTags) {
    const { data: player } = await svc
      .from("players")
      .select("seed_tag")
      .eq("id", entrantId)
      .single();
    const tag = (player?.seed_tag ?? "").trim();
    const pos = Object.entries(slotTags).find(([, t]) => t === tag)?.[0];
    if (!pos) return { error: "missing_tag" };
    allowedP = Number(pos);
  }

  const { data: rpcResult, error: rpcErr } = await svc.rpc("t_draw_tap", {
    p_code: code,
    p_entrant_id: entrantId,
    p_allowed_p: allowedP,
  });

  if (
    !rpcErr &&
    rpcResult !== null &&
    typeof rpcResult === "object" &&
    "g" in rpcResult &&
    "p" in rpcResult
  ) {
    return {
      ok: true,
      groupIdx: (rpcResult as { g: number }).g,
      position: (rpcResult as { p: number }).p,
    };
  }
  if (rpcErr) {
    const known = ["already_drawn", "all_slots_full", "session_not_active", "invalid_entrant"];
    const hit = known.find((k) => String(rpcErr.message).includes(k));
    if (hit) return { error: hit };
  }

  // Fallback: JS-level read-modify-write (small race window)
  const slotSizes = session.slot_sizes as number[];
  const { data: fresh } = await svc
    .from("t_draw_sessions")
    .select("assignments")
    .eq("code", code)
    .single();
  const assignments = (fresh?.assignments ?? {}) as Record<string, { g: number; p: number }>;
  if (entrantId in assignments) return { error: "already_drawn" };

  const occupied = new Set<string>();
  for (const v of Object.values(assignments)) occupied.add(`${v.g}-${v.p}`);
  const available: { g: number; p: number }[] = [];
  for (let g = 0; g < slotSizes.length; g++) {
    for (let p = 1; p <= slotSizes[g]!; p++) {
      if ((allowedP === null || p === allowedP) && !occupied.has(`${g}-${p}`))
        available.push({ g, p });
    }
  }
  if (available.length === 0) return { error: "all_slots_full" };

  const chosen = available[Math.floor(Math.random() * available.length)]!;
  const { error } = await svc
    .from("t_draw_sessions")
    .update({
      assignments: { ...assignments, [entrantId]: chosen },
      updated_at: new Date().toISOString(),
    })
    .eq("code", code);
  if (error) return { error: error.message };
  return { ok: true, groupIdx: chosen.g, position: chosen.p };
}

/** Owner confirms: persist assignments into teams / create pair teams. */
export async function applyTournamentDrawSession(
  code: string,
): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const { data } = await svc
    .from("t_draw_sessions")
    .select("code, tournament_id, owner_id, mode, slot_sizes, entrant_tokens, assignments, status")
    .eq("code", code)
    .single();
  const session = data as DrawSessionRow | null;
  if (!session) return { error: "session_not_found" };
  if (session.owner_id !== user.id) return { error: "unauthorized" };
  if (session.status !== "active") return { error: "session_not_active" };

  const assignments = session.assignments;
  const entrantIds = Object.keys(session.entrant_tokens);
  if (entrantIds.some((id) => !(id in assignments)))
    return { error: "incomplete_assignment" };

  if (session.mode === "group") {
    for (const [teamId, slot] of Object.entries(assignments)) {
      await svc
        .from("teams")
        .update({ group_label: String.fromCharCode(65 + slot.g) })
        .eq("id", teamId)
        .eq("tournament_id", session.tournament_id);
    }
  } else if (session.mode === "slot") {
    for (const [teamId, slot] of Object.entries(assignments)) {
      await svc
        .from("teams")
        .update({ seed: slot.g + 1 })
        .eq("id", teamId)
        .eq("tournament_id", session.tournament_id);
    }
  } else {
    // pair — create the teams from drawn slots
    const { count: teamCountExisting } = await svc
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", session.tournament_id);
    if ((teamCountExisting ?? 0) > 0) return { error: "teams_exist" };

    const teamBuckets: string[][] = session.slot_sizes.map(() => []);
    for (const [pid, slot] of Object.entries(assignments)) {
      teamBuckets[slot.g]![slot.p - 1] = pid;
    }
    for (let t = 0; t < teamBuckets.length; t++) {
      const memberIds = teamBuckets[t]!.filter(Boolean);
      if (memberIds.length !== session.slot_sizes[t])
        return { error: "incomplete_assignment" };
      // Tên đội mặc định "Đội N" — thành viên xem ở cột Thành viên (team_members)
      const name = `Đội ${t + 1}`;
      const { data: team, error: teamErr } = await svc
        .from("teams")
        .insert({ tournament_id: session.tournament_id, name, seed: t + 1 })
        .select("id")
        .single();
      if (teamErr || !team) return { error: teamErr?.message ?? "insert_failed" };
      const { error: memErr } = await svc
        .from("team_members")
        .insert(memberIds.map((pid) => ({ team_id: team.id, player_id: pid })));
      if (memErr) return { error: memErr.message };
    }
  }

  await svc
    .from("t_draw_sessions")
    .update({ status: "applied", updated_at: new Date().toISOString() })
    .eq("code", code);

  revalidatePath("/t", "layout");
  return { ok: true };
}

export async function cancelTournamentDrawSession(
  code: string,
): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();
  const { data: session } = await svc
    .from("t_draw_sessions")
    .select("owner_id, status")
    .eq("code", code)
    .single();
  if (!session) return { error: "session_not_found" };
  if (session.owner_id !== user.id) return { error: "unauthorized" };
  if (session.status !== "active") return { error: "session_not_active" };
  const { error } = await svc
    .from("t_draw_sessions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("code", code);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function resetTournamentDrawAssignments(
  code: string,
): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();
  const { data: session } = await svc
    .from("t_draw_sessions")
    .select("owner_id, status, assignments")
    .eq("code", code)
    .single();
  if (!session) return { error: "session_not_found" };
  if (session.owner_id !== user.id) return { error: "unauthorized" };
  if (session.status !== "active") return { error: "session_not_active" };
  // Giữ lại các cặp đã ghim — chỉ xoá kết quả do người chơi tự quay
  const kept: Record<string, unknown> = {};
  for (const [id, v] of Object.entries(
    (session.assignments ?? {}) as Record<string, { pinned?: boolean }>,
  )) {
    if (v && v.pinned) kept[id] = v;
  }
  const { error } = await svc
    .from("t_draw_sessions")
    .update({ assignments: kept, updated_at: new Date().toISOString() })
    .eq("code", code);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function resetTournamentDrawEntrant(
  code: string,
  entrantId: string,
): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();
  const { data: session } = await svc
    .from("t_draw_sessions")
    .select("owner_id, status, assignments")
    .eq("code", code)
    .single();
  if (!session) return { error: "session_not_found" };
  if (session.owner_id !== user.id) return { error: "unauthorized" };
  if (session.status !== "active") return { error: "session_not_active" };
  const assignments = {
    ...((session.assignments ?? {}) as Record<string, { pinned?: boolean }>),
  };
  if (!(entrantId in assignments)) return { error: "entrant_not_drawn" };
  if (assignments[entrantId]?.pinned) return { error: "pinned" };
  delete assignments[entrantId];
  const { error } = await svc
    .from("t_draw_sessions")
    .update({ assignments, updated_at: new Date().toISOString() })
    .eq("code", code);
  if (error) return { error: error.message };
  return { ok: true };
}
