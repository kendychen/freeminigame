"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser, getOptionalUser } from "@/lib/auth";
import { ensureSafeSlug, withRandomSuffix } from "@/lib/slug";
import { buildTeamSchedule } from "@/lib/team/schedule";
import {
  MAX_PLAYERS_PER_EVENT,
  MAX_SQUADS,
  meetsRosterMinimum,
  validateRubberScore,
  validateSquadRoster,
  validateTeamConfig,
  validateTieLineup,
} from "@/lib/team/validate";
import type {
  DbTeamEvent,
  DbTeamPlayer,
  DbTeamRubber,
  DbTeamSquad,
  DbTeamTie,
  Gender,
  RubberCategory,
  TeamConfig,
  TeamEventFull,
} from "@/lib/team/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

type Svc = ReturnType<typeof createServiceClient>;

function newToken(): string {
  return randomBytes(18).toString("base64url");
}

function revalidateTeam(slug: string) {
  revalidatePath(`/team/${slug}`);
  revalidatePath(`/team/v/${slug}`);
}

function eventConfig(ev: DbTeamEvent): TeamConfig {
  const cfg = (ev.config ?? {}) as Partial<TeamConfig>;
  return {
    teamSize: cfg.teamSize ?? 6,
    rubbers: cfg.rubbers ?? [],
    targetPoints: cfg.targetPoints ?? 15,
    allowRepeatPlayer: cfg.allowRepeatPlayer !== false,
  };
}

async function requireOwnerEvent(svc: Svc, eventId: string): Promise<DbTeamEvent | null> {
  const { user } = await requireUser();
  const { data: ev } = await svc
    .from("team_events")
    .select("*")
    .eq("id", eventId)
    .single();
  if (!ev || ev.owner_id !== user.id) return null;
  return ev as DbTeamEvent;
}

async function insertMissingRubbers(
  svc: Svc,
  eventId: string,
  rubbers: RubberCategory[],
): Promise<string | null> {
  if (rubbers.length === 0) return null;
  const [tiesRes, rubbersRes] = await Promise.all([
    svc.from("team_ties").select("id").eq("event_id", eventId),
    svc.from("team_rubbers").select("tie_id").eq("event_id", eventId),
  ]);
  const has = new Set((rubbersRes.data ?? []).map((r) => r.tie_id));
  const missing = (tiesRes.data ?? []).filter((t) => !has.has(t.id));
  if (missing.length === 0) return null;
  const rows = missing.flatMap((t) =>
    rubbers.map((category, i) => ({
      tie_id: t.id,
      event_id: eventId,
      rubber_no: i + 1,
      category,
      status: "pending",
    })),
  );
  const { error } = await svc.from("team_rubbers").insert(rows);
  return error ? error.message : null;
}

/**
 * CONTRACT (bất biến của team mode): toàn bộ logic thắng/thua & tổng hợp tie nằm
 * trong đúng MỘT chỗ — hàm này. Mọi thay đổi trạng thái rubber (scoreTeamRubber,
 * setRubberWalkover, reopenTeamRubber) và setTieWinner đều đi qua cùng hàm recount
 * này; không bao giờ tạo đường finalize thứ hai (không RPC finalize cho team mode).
 *
 * Recount từ toàn bộ rubber của tie (idempotent, không increment):
 * - rubbers_won_a/b = rubber completed thắng theo score + walkover có winner;
 *   walkover-hủy (walkover_winner NULL) không tính cho bên nào.
 * - Khi 0 rubber pending: nhiều rubber thắng hơn → thắng; bằng → hiệu số điểm
 *   các rubber completed; vẫn bằng → dùng manualWinnerSquadId (setTieWinner),
 *   không có thì tie giữ pending chờ owner phân định.
 * - Tie chỉ completed khi có winner_squad_id; mọi tie completed → event stage
 *   'done', còn tie pending → lùi về 'group'.
 */
async function recountTie(
  svc: Svc,
  tieId: string,
  manualWinnerSquadId?: string,
): Promise<string | null> {
  const { data: tie } = await svc.from("team_ties").select("*").eq("id", tieId).single();
  if (!tie) return "not_found";

  const { data: rubbersData } = await svc
    .from("team_rubbers")
    .select("*")
    .eq("tie_id", tieId);
  const rubbers = (rubbersData ?? []) as DbTeamRubber[];

  let wonA = 0;
  let wonB = 0;
  let pointDiff = 0;
  let pending = 0;
  for (const r of rubbers) {
    if (r.status === "completed") {
      if (r.score_a > r.score_b) wonA += 1;
      else if (r.score_b > r.score_a) wonB += 1;
      pointDiff += r.score_a - r.score_b;
    } else if (r.status === "walkover") {
      if (r.walkover_winner === "a") wonA += 1;
      else if (r.walkover_winner === "b") wonB += 1;
    } else {
      pending += 1;
    }
  }

  let winner: string | null = null;
  if (pending === 0 && rubbers.length > 0 && tie.squad_a_id && tie.squad_b_id) {
    if (wonA > wonB) winner = tie.squad_a_id;
    else if (wonB > wonA) winner = tie.squad_b_id;
    else if (pointDiff > 0) winner = tie.squad_a_id;
    else if (pointDiff < 0) winner = tie.squad_b_id;
    else winner = manualWinnerSquadId ?? null;
  }

  const { error: tieErr } = await svc
    .from("team_ties")
    .update({
      rubbers_won_a: wonA,
      rubbers_won_b: wonB,
      winner_squad_id: winner,
      status: winner ? "completed" : "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", tieId);
  if (tieErr) return tieErr.message;

  const { data: ev } = await svc
    .from("team_events")
    .select("stage")
    .eq("id", tie.event_id)
    .single();
  if (!ev || (ev.stage !== "group" && ev.stage !== "done")) return null;

  const { data: allTies } = await svc
    .from("team_ties")
    .select("status")
    .eq("event_id", tie.event_id);
  const ties = allTies ?? [];
  const nextStage =
    ties.length > 0 && ties.every((t) => t.status === "completed") ? "done" : "group";
  if (nextStage !== ev.stage) {
    await svc
      .from("team_events")
      .update({ stage: nextStage, updated_at: new Date().toISOString() })
      .eq("id", tie.event_id);
  }
  return null;
}

// ── Load full event state ──────────────────────────────────────────────────────

async function loadTeamEventRows(svc: ReturnType<typeof createServiceClient>, idOrSlug: string) {
  const isUuid = /^[0-9a-f-]{36}$/.test(idOrSlug);
  const { data: ev } = await svc
    .from("team_events")
    .select("*")
    .eq(isUuid ? "id" : "slug", idOrSlug)
    .single();
  if (!ev) return null;

  const [squadsRes, playersRes, tiesRes, rubbersRes] = await Promise.all([
    svc.from("team_squads").select("*").eq("event_id", ev.id).order("created_at"),
    svc.from("team_players").select("*").eq("event_id", ev.id).order("created_at"),
    svc.from("team_ties").select("*").eq("event_id", ev.id).order("tie_no"),
    svc.from("team_rubbers").select("*").eq("event_id", ev.id).order("rubber_no"),
  ]);
  return {
    ev: ev as DbTeamEvent,
    squads: (squadsRes.data ?? []) as DbTeamSquad[],
    players: (playersRes.data ?? []) as DbTeamPlayer[],
    ties: (tiesRes.data ?? []) as DbTeamTie[],
    rubbers: (rubbersRes.data ?? []) as DbTeamRubber[],
  };
}

/** Read-only variant for anonymous pollers (TV): never writes, never returns the referee token. */
export async function loadTeamTvState(idOrSlug: string): Promise<TeamEventFull | null> {
  const rows = await loadTeamEventRows(createServiceClient(), idOrSlug);
  if (!rows) return null;
  const { ev, squads, players, ties, rubbers } = rows;
  return {
    event: { ...ev, config: eventConfig(ev), referee_token: null },
    squads,
    players,
    ties,
    rubbers,
    refereeToken: null,
  };
}

export async function loadTeamEventState(idOrSlug: string): Promise<TeamEventFull | null> {
  const svc = createServiceClient();
  const rows = await loadTeamEventRows(svc, idOrSlug);
  if (!rows) return null;
  const { ev, ties } = rows;
  const squadsRes = { data: rows.squads };
  const playersRes = { data: rows.players };
  let rubbers = rows.rubbers;

  const config = eventConfig(ev as DbTeamEvent);
  const withRubbers = new Set(rubbers.map((r) => r.tie_id));
  if (config.rubbers.length > 0 && ties.some((t) => !withRubbers.has(t.id))) {
    await insertMissingRubbers(svc, ev.id, config.rubbers);
    const { data: healed } = await svc
      .from("team_rubbers")
      .select("*")
      .eq("event_id", ev.id)
      .order("rubber_no");
    rubbers = (healed ?? []) as DbTeamRubber[];
  }

  const { user } = await getOptionalUser();
  const isOwner = !!user && ev.owner_id === user.id;
  const refereeToken = isOwner ? (ev.referee_token ?? null) : null;

  return {
    event: { ...(ev as DbTeamEvent), config, referee_token: refereeToken },
    squads: (squadsRes.data ?? []) as DbTeamSquad[],
    players: (playersRes.data ?? []) as DbTeamPlayer[],
    ties,
    rubbers,
    refereeToken,
  };
}

// ── Create event (squads/players added separately) ─────────────────────────────

export async function createTeamEvent(
  name: string,
  config: TeamConfig,
): Promise<{ slug: string } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const trimmed = name.trim();
  if (!trimmed) return { error: "empty_name" };
  if (trimmed.length > 120) return { error: "name_too_long" };
  const cfgErr = validateTeamConfig(config);
  if (cfgErr) return { error: cfgErr.message };

  let slug = ensureSafeSlug(trimmed);
  if (!slug || slug === "tour") slug = "team";
  slug = withRandomSuffix(slug);

  const { error: evErr } = await svc.from("team_events").insert({
    name: trimmed,
    slug,
    owner_id: user.id,
    config: {
      teamSize: config.teamSize,
      rubbers: config.rubbers,
      targetPoints: config.targetPoints,
      allowRepeatPlayer: config.allowRepeatPlayer !== false,
    },
    stage: "setup",
  });
  if (evErr) return { error: evErr.message };

  revalidatePath("/dashboard");
  return { slug };
}

// ── Update event config ────────────────────────────────────────────────────────

export async function updateTeamConfig(
  eventId: string,
  patch: Partial<TeamConfig> & { name?: string },
): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };

  if (patch.rubbers) {
    const { data: ties } = await svc
      .from("team_ties")
      .select("id")
      .eq("event_id", eventId)
      .limit(1);
    if (ties && ties.length > 0) return { error: "rubbers_locked" };
  }

  const { name, ...cfgPatch } = patch;
  const merged: TeamConfig = { ...eventConfig(ev), ...cfgPatch };
  const cfgErr = validateTeamConfig(merged);
  if (cfgErr) return { error: cfgErr.message };

  const updates: Record<string, unknown> = {
    config: merged,
    updated_at: new Date().toISOString(),
  };
  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) return { error: "empty_name" };
    if (trimmed.length > 120) return { error: "name_too_long" };
    updates.name = trimmed;
  }

  const { error } = await svc.from("team_events").update(updates).eq("id", eventId);
  if (error) return { error: error.message };

  revalidateTeam(ev.slug);
  return { ok: true };
}

// ── Squads CRUD ────────────────────────────────────────────────────────────────

export async function addTeamSquad(
  eventId: string,
  name: string,
): Promise<{ id: string } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };
  if (ev.stage !== "setup") return { error: "Đã tạo lịch thi đấu — không thể thêm đội" };

  const trimmed = name.trim();
  if (!trimmed) return { error: "empty_name" };
  if (trimmed.length > 80) return { error: "name_too_long" };

  const { data: existing } = await svc
    .from("team_squads")
    .select("id")
    .eq("event_id", eventId);
  if ((existing?.length ?? 0) >= MAX_SQUADS) return { error: `Tối đa ${MAX_SQUADS} đội` };

  const { data: squad, error } = await svc
    .from("team_squads")
    .insert({ event_id: eventId, name: trimmed })
    .select("id")
    .single();
  if (error || !squad) return { error: error?.message ?? "add_failed" };

  revalidateTeam(ev.slug);
  return { id: squad.id };
}

export async function updateTeamSquad(
  eventId: string,
  squadId: string,
  name: string,
): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };

  const trimmed = name.trim();
  if (!trimmed) return { error: "empty_name" };
  if (trimmed.length > 80) return { error: "name_too_long" };

  const { error } = await svc
    .from("team_squads")
    .update({ name: trimmed })
    .eq("id", squadId)
    .eq("event_id", eventId);
  if (error) return { error: error.message };

  revalidateTeam(ev.slug);
  return { ok: true };
}

export async function removeTeamSquad(
  eventId: string,
  squadId: string,
): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };

  const { data: ties } = await svc
    .from("team_ties")
    .select("id")
    .eq("event_id", eventId)
    .limit(1);
  if (ties && ties.length > 0) return { error: "Đã tạo lịch thi đấu — không thể xóa đội" };

  const { error } = await svc
    .from("team_squads")
    .delete()
    .eq("id", squadId)
    .eq("event_id", eventId);
  if (error) return { error: error.message };

  revalidateTeam(ev.slug);
  return { ok: true };
}

export async function bulkAddTeamSquads(
  eventId: string,
  names: string[],
): Promise<{ count: number } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };
  if (ev.stage !== "setup") return { error: "Đã tạo lịch thi đấu — không thể thêm đội" };

  const trimmed = names.map((n) => n.trim().slice(0, 80)).filter(Boolean);
  if (!trimmed.length) return { count: 0 };

  const { data: existing } = await svc
    .from("team_squads")
    .select("id")
    .eq("event_id", eventId);
  if ((existing?.length ?? 0) + trimmed.length > MAX_SQUADS)
    return { error: `Tối đa ${MAX_SQUADS} đội` };

  const { data, error } = await svc
    .from("team_squads")
    .insert(trimmed.map((name) => ({ event_id: eventId, name })))
    .select("id");
  if (error) return { error: error.message };

  revalidateTeam(ev.slug);
  return { count: data?.length ?? 0 };
}

// ── Players CRUD ───────────────────────────────────────────────────────────────

export async function addTeamPlayer(
  eventId: string,
  squadId: string | null,
  name: string,
  gender: Gender,
): Promise<{ id: string } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };

  const trimmed = name.trim();
  if (!trimmed) return { error: "empty_name" };
  if (trimmed.length > 100) return { error: "name_too_long" };
  if (gender !== "M" && gender !== "F") return { error: "Giới tính phải là Nam hoặc Nữ" };

  if (squadId) {
    const { data: squad } = await svc
      .from("team_squads")
      .select("id")
      .eq("id", squadId)
      .eq("event_id", eventId)
      .single();
    if (!squad) return { error: "not_found" };
  }

  const { data: existing } = await svc
    .from("team_players")
    .select("id")
    .eq("event_id", eventId);
  if ((existing?.length ?? 0) >= MAX_PLAYERS_PER_EVENT)
    return { error: `Tối đa ${MAX_PLAYERS_PER_EVENT} VĐV mỗi giải` };

  const { data: player, error } = await svc
    .from("team_players")
    .insert({ event_id: eventId, squad_id: squadId, name: trimmed, gender })
    .select("id")
    .single();
  if (error || !player) return { error: error?.message ?? "add_failed" };

  revalidateTeam(ev.slug);
  return { id: player.id };
}

export async function updateTeamPlayer(
  eventId: string,
  playerId: string,
  patch: { name?: string; gender?: Gender; squadId?: string | null },
): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };

  const { data: player } = await svc
    .from("team_players")
    .select("*")
    .eq("id", playerId)
    .eq("event_id", eventId)
    .single();
  if (!player) return { error: "not_found" };

  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: "empty_name" };
    if (trimmed.length > 100) return { error: "name_too_long" };
    updates.name = trimmed;
  }

  const genderChanged = patch.gender !== undefined && patch.gender !== player.gender;
  const squadChanged = patch.squadId !== undefined && patch.squadId !== player.squad_id;

  if (genderChanged && patch.gender !== "M" && patch.gender !== "F")
    return { error: "Giới tính phải là Nam hoặc Nữ" };

  if (genderChanged || squadChanged) {
    const { data: refs } = await svc
      .from("team_rubbers")
      .select("id, category")
      .eq("event_id", eventId)
      .or(`a1_id.eq.${playerId},a2_id.eq.${playerId},b1_id.eq.${playerId},b2_id.eq.${playerId}`);
    const references = refs ?? [];
    if (genderChanged && references.some((r) => r.category !== "FD"))
      return { error: "gender_locked_in_lineup" };
    if (squadChanged && references.length > 0) return { error: "player_in_lineup" };
  }

  if (squadChanged && patch.squadId) {
    const { data: squad } = await svc
      .from("team_squads")
      .select("id")
      .eq("id", patch.squadId)
      .eq("event_id", eventId)
      .single();
    if (!squad) return { error: "not_found" };
  }

  if (ev.stage !== "setup" && (genderChanged || squadChanged) && player.squad_id) {
    const { data: mates } = await svc
      .from("team_players")
      .select("id, gender")
      .eq("squad_id", player.squad_id);
    const after = (mates ?? [])
      .filter((p) => !(squadChanged && p.id === playerId))
      .map((p) =>
        genderChanged && p.id === playerId ? { gender: patch.gender! } : { gender: p.gender },
      );
    if (!meetsRosterMinimum(after, eventConfig(ev))) return { error: "roster_below_minimum" };
  }

  if (genderChanged) updates.gender = patch.gender;
  if (squadChanged) updates.squad_id = patch.squadId;
  if (Object.keys(updates).length === 0) return { ok: true };

  const { error } = await svc
    .from("team_players")
    .update(updates)
    .eq("id", playerId)
    .eq("event_id", eventId);
  if (error) return { error: error.message };

  revalidateTeam(ev.slug);
  return { ok: true };
}

export async function removeTeamPlayer(
  eventId: string,
  playerId: string,
): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };

  const { data: player } = await svc
    .from("team_players")
    .select("id, squad_id")
    .eq("id", playerId)
    .eq("event_id", eventId)
    .single();
  if (!player) return { error: "not_found" };

  const { data: refs } = await svc
    .from("team_rubbers")
    .select("id")
    .eq("event_id", eventId)
    .or(`a1_id.eq.${playerId},a2_id.eq.${playerId},b1_id.eq.${playerId},b2_id.eq.${playerId}`)
    .limit(1);
  if (refs && refs.length > 0) return { error: "player_in_lineup" };

  if (ev.stage !== "setup" && player.squad_id) {
    const { data: mates } = await svc
      .from("team_players")
      .select("id, gender")
      .eq("squad_id", player.squad_id);
    const after = (mates ?? []).filter((p) => p.id !== playerId);
    if (!meetsRosterMinimum(after, eventConfig(ev))) return { error: "roster_below_minimum" };
  }

  const { error } = await svc
    .from("team_players")
    .delete()
    .eq("id", playerId)
    .eq("event_id", eventId);
  if (error) return { error: error.message };

  revalidateTeam(ev.slug);
  return { ok: true };
}

export async function bulkAddTeamPlayers(
  eventId: string,
  squadId: string | null,
  players: { name: string; gender: Gender }[],
): Promise<{ count: number } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };

  if (squadId) {
    const { data: squad } = await svc
      .from("team_squads")
      .select("id")
      .eq("id", squadId)
      .eq("event_id", eventId)
      .single();
    if (!squad) return { error: "not_found" };
  }

  const rows = players
    .map((p) => ({ name: p.name.trim().slice(0, 100), gender: p.gender }))
    .filter((p) => p.name && (p.gender === "M" || p.gender === "F"));
  if (!rows.length) return { count: 0 };

  const { data: existing } = await svc
    .from("team_players")
    .select("id")
    .eq("event_id", eventId);
  if ((existing?.length ?? 0) + rows.length > MAX_PLAYERS_PER_EVENT)
    return { error: `Tối đa ${MAX_PLAYERS_PER_EVENT} VĐV mỗi giải` };

  const { data, error } = await svc
    .from("team_players")
    .insert(rows.map((p) => ({ event_id: eventId, squad_id: squadId, ...p })))
    .select("id");
  if (error) return { error: error.message };

  revalidateTeam(ev.slug);
  return { count: data?.length ?? 0 };
}

// ── Generate schedule (ties + rubbers, 2-phase) ────────────────────────────────

export async function generateTeamSchedule(
  eventId: string,
  groupCount: number,
): Promise<{ ok: true } | { error: string; detail?: string[] }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };

  const config = eventConfig(ev);
  if (config.rubbers.length === 0) return { error: "Chưa cấu hình nội dung thi đấu" };

  const { data: existing } = await svc
    .from("team_ties")
    .select("id")
    .eq("event_id", eventId)
    .limit(1);
  if (existing && existing.length > 0) return { error: "schedule_exists" };

  const [squadsRes, playersRes] = await Promise.all([
    svc.from("team_squads").select("id, name").eq("event_id", eventId).order("created_at"),
    svc.from("team_players").select("squad_id, gender").eq("event_id", eventId),
  ]);
  const squads = squadsRes.data ?? [];
  if (squads.length < 2) return { error: "not_enough_teams" };
  if (
    !Number.isInteger(groupCount) ||
    groupCount < 1 ||
    groupCount > Math.floor(squads.length / 2)
  )
    return { error: "Số bảng không hợp lệ" };

  const players = (playersRes.data ?? []) as Pick<DbTeamPlayer, "squad_id" | "gender">[];
  const detail: string[] = [];
  for (const squad of squads) {
    const roster = players.filter((p) => p.squad_id === squad.id);
    detail.push(...validateSquadRoster(squad.name, roster, config));
  }
  if (detail.length > 0) return { error: "roster_below_minimum", detail };

  const { groups, ties } = buildTeamSchedule(squads.map((s) => s.id), groupCount);

  // Insert ties FIRST: UNIQUE(event_id, tie_no) is the double-generate guard, so
  // the loser of a concurrent race bails out here without touching squad rows —
  // group_label/seed never desync from the ties that actually won.
  const { data: insertedTies, error: tieErr } = await svc
    .from("team_ties")
    .insert(ties.map((t) => ({ event_id: eventId, ...t })))
    .select("id");
  if (tieErr || !insertedTies)
    return { error: tieErr?.code === "23505" ? "schedule_exists" : tieErr?.message ?? "insert_failed" };

  for (const group of groups) {
    for (let i = 0; i < group.squadIds.length; i++) {
      await svc
        .from("team_squads")
        .update({ group_label: group.label, seed: i })
        .eq("id", group.squadIds[i]!)
        .eq("event_id", eventId);
    }
  }

  const { error: stageErr } = await svc
    .from("team_events")
    .update({ stage: "group", updated_at: new Date().toISOString() })
    .eq("id", eventId);
  if (stageErr) return { error: stageErr.message };

  const rubberRows = insertedTies.flatMap((t) =>
    config.rubbers.map((category, i) => ({
      tie_id: t.id,
      event_id: eventId,
      rubber_no: i + 1,
      category,
      status: "pending",
    })),
  );
  const { error: rubberErr } = await svc.from("team_rubbers").insert(rubberRows);
  if (rubberErr) return { error: rubberErr.message };

  revalidateTeam(ev.slug);
  return { ok: true };
}

// ── Reset schedule (back to setup) ─────────────────────────────────────────────

export async function resetTeamSchedule(
  eventId: string,
): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };

  const { data: scored } = await svc
    .from("team_rubbers")
    .select("id")
    .eq("event_id", eventId)
    .neq("status", "pending")
    .limit(1);
  if (scored && scored.length > 0)
    return { error: "Đã có trận hoàn thành, không thể đặt lại lịch" };

  await svc.from("team_rubbers").delete().eq("event_id", eventId);
  await svc.from("team_ties").delete().eq("event_id", eventId);
  await svc.from("team_squads").update({ group_label: null }).eq("event_id", eventId);
  const { error } = await svc
    .from("team_events")
    .update({ stage: "setup", updated_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) return { error: error.message };

  revalidateTeam(ev.slug);
  return { ok: true };
}

// ── Ensure rubbers exist for every tie (idempotent self-heal) ──────────────────

export async function ensureTieRubbers(
  eventId: string,
): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };

  const err = await insertMissingRubbers(svc, eventId, eventConfig(ev).rubbers);
  if (err) return { error: err };

  revalidateTeam(ev.slug);
  return { ok: true };
}

// ── Tie lineup (batch) ─────────────────────────────────────────────────────────

export async function setTieLineup(
  eventId: string,
  tieId: string,
  slots: {
    rubberId: string;
    a1: string | null;
    a2: string | null;
    b1: string | null;
    b2: string | null;
  }[],
): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };
  if (slots.length === 0) return { ok: true };

  const { data: tie } = await svc
    .from("team_ties")
    .select("*")
    .eq("id", tieId)
    .eq("event_id", eventId)
    .single();
  if (!tie) return { error: "not_found" };

  const { data: rubbersData } = await svc
    .from("team_rubbers")
    .select("*")
    .eq("tie_id", tieId)
    .order("rubber_no");
  const rubbers = (rubbersData ?? []) as DbTeamRubber[];
  const byId = new Map(rubbers.map((r) => [r.id, r]));

  for (const slot of slots) {
    const rubber = byId.get(slot.rubberId);
    if (!rubber) return { error: "not_found" };
    if (rubber.status !== "pending") return { error: "rubber_completed" };
  }

  const { data: playersData } = await svc
    .from("team_players")
    .select("id, squad_id, gender")
    .eq("event_id", eventId);

  const edits = new Map(slots.map((s) => [s.rubberId, s]));
  const entries = rubbers.map((r) => {
    const e = edits.get(r.id);
    return {
      rubberId: r.id,
      category: r.category,
      slots: e
        ? { a1: e.a1, a2: e.a2, b1: e.b1, b2: e.b2 }
        : { a1: r.a1_id, a2: r.a2_id, b1: r.b1_id, b2: r.b2_id },
    };
  });
  const lineupErr = validateTieLineup(
    entries,
    (playersData ?? []) as Pick<DbTeamPlayer, "id" | "squad_id" | "gender">[],
    tie.squad_a_id,
    tie.squad_b_id,
    eventConfig(ev).allowRepeatPlayer,
  );
  if (lineupErr) return { error: lineupErr.message };

  for (const slot of slots) {
    const { error } = await svc
      .from("team_rubbers")
      .update({
        a1_id: slot.a1,
        a2_id: slot.a2,
        b1_id: slot.b1,
        b2_id: slot.b2,
        updated_at: new Date().toISOString(),
      })
      .eq("id", slot.rubberId);
    if (error) return { error: error.message };
  }

  revalidateTeam(ev.slug);
  return { ok: true };
}

// ── Score a rubber (the ONLY scoring write path — see recountTie contract) ─────

export async function scoreTeamRubber({
  eventId,
  rubberId,
  scoreA,
  scoreB,
  token,
}: {
  eventId: string;
  rubberId: string;
  scoreA: number;
  scoreB: number;
  token?: string;
}): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();

  let slug: string;
  if (token) {
    const { data: ev } = await svc
      .from("team_events")
      .select("slug, referee_token")
      .eq("id", eventId)
      .single();
    if (!ev || ev.referee_token !== token) return { error: "invalid_token" };
    slug = ev.slug;
  } else {
    const ev = await requireOwnerEvent(svc, eventId);
    if (!ev) return { error: "unauthorized" };
    slug = ev.slug;
  }

  const { data: rubber } = await svc
    .from("team_rubbers")
    .select("*")
    .eq("id", rubberId)
    .eq("event_id", eventId)
    .single();
  if (!rubber) return { error: "not_found" };
  if (rubber.status === "walkover") return { error: "rubber_walkover" };

  const a = Math.max(0, Math.min(99, Math.trunc(scoreA)));
  const b = Math.max(0, Math.min(99, Math.trunc(scoreB)));
  const scoreErr = validateRubberScore(a, b);
  if (scoreErr) return { error: scoreErr.message };

  const { error: upErr } = await svc
    .from("team_rubbers")
    .update({
      score_a: a,
      score_b: b,
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", rubberId);
  if (upErr) return { error: upErr.message };

  const recountErr = await recountTie(svc, rubber.tie_id);
  if (recountErr) return { error: recountErr };

  revalidateTeam(slug);
  return { ok: true };
}

// ── Walkover (owner only): 'a'/'b' = xử thắng, null = hủy nội dung ─────────────

export async function setRubberWalkover({
  eventId,
  rubberId,
  winner,
}: {
  eventId: string;
  rubberId: string;
  winner: "a" | "b" | null;
}): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };
  if (winner !== "a" && winner !== "b" && winner !== null)
    return { error: "invalid_payload" };

  const { data: rubber } = await svc
    .from("team_rubbers")
    .select("id, tie_id, status")
    .eq("id", rubberId)
    .eq("event_id", eventId)
    .single();
  if (!rubber) return { error: "not_found" };
  if (rubber.status === "completed") return { error: "rubber_completed" };

  const { error: upErr } = await svc
    .from("team_rubbers")
    .update({
      status: "walkover",
      walkover_winner: winner,
      score_a: 0,
      score_b: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rubberId);
  if (upErr) return { error: upErr.message };

  const recountErr = await recountTie(svc, rubber.tie_id);
  if (recountErr) return { error: recountErr };

  revalidateTeam(ev.slug);
  return { ok: true };
}

// ── Reopen a completed/walkover rubber (owner only) ────────────────────────────

export async function reopenTeamRubber({
  eventId,
  rubberId,
}: {
  eventId: string;
  rubberId: string;
}): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };

  const { data: rubber } = await svc
    .from("team_rubbers")
    .select("id, tie_id")
    .eq("id", rubberId)
    .eq("event_id", eventId)
    .single();
  if (!rubber) return { error: "not_found" };

  const { error: upErr } = await svc
    .from("team_rubbers")
    .update({
      status: "pending",
      walkover_winner: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rubberId);
  if (upErr) return { error: upErr.message };

  const recountErr = await recountTie(svc, rubber.tie_id);
  if (recountErr) return { error: recountErr };

  revalidateTeam(ev.slug);
  return { ok: true };
}

// ── Manual tie winner (owner only — §2.2c: rubbers + point diff both level) ────

export async function setTieWinner({
  eventId,
  tieId,
  winner,
}: {
  eventId: string;
  tieId: string;
  winner: "a" | "b";
}): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const ev = await requireOwnerEvent(svc, eventId);
  if (!ev) return { error: "unauthorized" };
  if (winner !== "a" && winner !== "b") return { error: "invalid_payload" };

  const { data: tie } = await svc
    .from("team_ties")
    .select("*")
    .eq("id", tieId)
    .eq("event_id", eventId)
    .single();
  if (!tie) return { error: "not_found" };
  const winnerSquadId = winner === "a" ? tie.squad_a_id : tie.squad_b_id;
  if (!winnerSquadId) return { error: "not_found" };

  const { data: rubbers } = await svc
    .from("team_rubbers")
    .select("status")
    .eq("tie_id", tieId);
  if (!rubbers || rubbers.length === 0 || rubbers.some((r) => r.status === "pending"))
    return { error: "tie_not_finished" };

  const recountErr = await recountTie(svc, tieId, winnerSquadId);
  if (recountErr) return { error: recountErr };

  const { data: after } = await svc
    .from("team_ties")
    .select("winner_squad_id")
    .eq("id", tieId)
    .single();
  if (after?.winner_squad_id !== winnerSquadId) return { error: "tie_already_decided" };

  revalidateTeam(ev.slug);
  return { ok: true };
}

// ── Referee token ──────────────────────────────────────────────────────────────

export async function getTeamRefereeToken(
  eventId: string,
): Promise<{ token: string } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const { data: ev } = await svc
    .from("team_events")
    .select("owner_id, referee_token")
    .eq("id", eventId)
    .single();
  if (!ev || ev.owner_id !== user.id) return { error: "unauthorized" };
  if (ev.referee_token) return { token: ev.referee_token };

  const token = newToken();
  const { error } = await svc
    .from("team_events")
    .update({ referee_token: token })
    .eq("id", eventId);
  if (error) return { error: error.message };
  return { token };
}

export async function deleteTeamEvent(
  eventId: string,
): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const { data: ev } = await svc
    .from("team_events")
    .select("owner_id")
    .eq("id", eventId)
    .single();
  if (!ev || ev.owner_id !== user.id) return { error: "forbidden" };

  // FK ON DELETE CASCADE dọn sạch squads/players/ties/rubbers
  const { error } = await svc.from("team_events").delete().eq("id", eventId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
