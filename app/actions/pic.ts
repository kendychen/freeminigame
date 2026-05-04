"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/auth";
import { ensureSafeSlug, withRandomSuffix } from "@/lib/slug";
import { generateGroupSchedule } from "@/lib/pic-schedule";
import type { PicConfig, PicPlayer, PicGroup, PicMatch, PicState, PicStage } from "@/stores/pic-tournament";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PicEventFull = PicState & {
  referee_token: string | null;
  ownerId: string | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function snakeDistribute(ids: string[], groupCount: number): string[][] {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  let dir = 1, gi = 0;
  for (const id of ids) {
    groups[gi]!.push(id);
    const next = gi + dir;
    if (next >= groupCount || next < 0) dir = -dir;
    else gi += dir;
  }
  return groups;
}

function newToken(): string {
  return randomBytes(18).toString("base64url");
}

// ── Load full event state ──────────────────────────────────────────────────────

export async function loadPicEventState(idOrSlug: string): Promise<PicEventFull | null> {
  const svc = createServiceClient();

  const isUuid = /^[0-9a-f-]{36}$/.test(idOrSlug);
  const { data: ev } = await svc
    .from("pic_events")
    .select("*")
    .eq(isUuid ? "id" : "slug", idOrSlug)
    .single();
  if (!ev) return null;

  const [playersRes, groupsRes, matchesRes] = await Promise.all([
    svc.from("pic_players").select("*").eq("event_id", ev.id),
    svc.from("pic_groups").select("*").eq("event_id", ev.id).order("label"),
    svc.from("pic_matches").select("*").eq("event_id", ev.id).order("round"),
  ]);

  const players: PicPlayer[] = (playersRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));
  const dbGroups = groupsRes.data ?? [];
  const dbMatches = matchesRes.data ?? [];

  const groupIds = dbGroups.map((g) => g.id);
  const gpRes =
    groupIds.length > 0
      ? await svc.from("pic_group_players").select("*").in("group_id", groupIds)
      : { data: [] };
  const dbGP = gpRes.data ?? [];

  const groups: PicGroup[] = dbGroups.map((g) => {
    const playerIds = dbGP
      .filter((gp) => gp.group_id === g.id)
      .sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
      .map((gp) => gp.player_id);

    const matches: PicMatch[] = dbMatches
      .filter((m) => m.group_id === g.id)
      .map((m) => ({
        id: m.id,
        round: m.round,
        stage: "group" as const,
        a1: m.a1_id ?? "",
        a2: m.a2_id ?? "",
        b1: m.b1_id ?? "",
        b2: m.b2_id ?? "",
        scoreA: m.score_a,
        scoreB: m.score_b,
        status: m.status as "pending" | "completed",
      }));

    return { id: g.id, label: g.label, playerIds, matches };
  });

  const knockoutMatches: PicMatch[] = dbMatches
    .filter((m) => m.group_id === null)
    .map((m) => ({
      id: m.id,
      round: m.round,
      stage: m.stage as "semifinal" | "final" | "third",
      a1: m.a1_id ?? "",
      a2: m.a2_id ?? "",
      b1: m.b1_id ?? "",
      b2: m.b2_id ?? "",
      scoreA: m.score_a,
      scoreB: m.score_b,
      status: m.status as "pending" | "completed",
    }));

  const cfg = ev.config as PicConfig;
  return {
    id: ev.id,
    config: { ...cfg, name: ev.name ?? cfg?.name ?? "" },
    players,
    groups,
    knockoutMatches,
    stage: ev.stage as PicStage,
    createdAt: new Date(ev.created_at).getTime(),
    updatedAt: new Date(ev.updated_at).getTime(),
    referee_token: ev.referee_token ?? null,
    ownerId: ev.owner_id ?? null,
  };
}

// ── Create event (empty — players added separately) ───────────────────────────

export async function createPicEvent(
  config: Omit<PicConfig, "advancePerGroup">,
): Promise<{ slug: string } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  let slug = ensureSafeSlug(config.name);
  if (!slug || slug === "tour") slug = "pic";
  slug = withRandomSuffix(slug);

  const { data: ev, error: evErr } = await svc
    .from("pic_events")
    .insert({
      name: config.name,
      slug,
      owner_id: user.id,
      config: {
        targetGroup: config.targetGroup,
        targetKnockout: config.targetKnockout,
        advancePerGroup: 1,
        hasThirdPlace: config.hasThirdPlace,
        pointsForWin: config.pointsForWin ?? 2,
        pointsForLoss: config.pointsForLoss ?? 0,
      },
      stage: "group",
    })
    .select("id")
    .single();
  if (evErr || !ev) return { error: evErr?.message ?? "create_failed" };

  revalidatePath("/dashboard");
  return { slug };
}

// ── Update event config ────────────────────────────────────────────────────────

export async function updatePicConfig(
  eventId: string,
  patch: Partial<Pick<PicConfig, "name" | "targetGroup" | "targetKnockout" | "hasThirdPlace" | "pointsForWin" | "pointsForLoss" | "tiebreakerOrder">>,
): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const { data: ev } = await svc.from("pic_events").select("owner_id, config").eq("id", eventId).single();
  if (!ev || ev.owner_id !== user.id) return { error: "Không có quyền" };

  const cfg = (ev.config ?? {}) as PicConfig;
  const newConfig: PicConfig = { ...cfg, ...patch };

  const updates: Record<string, unknown> = { config: newConfig };
  if (patch.name) updates.name = patch.name;

  const { error } = await svc.from("pic_events").update(updates).eq("id", eventId);
  if (error) return { error: error.message };

  revalidatePath(`/pic`);
  return { ok: true };
}

// ── Add / remove player ────────────────────────────────────────────────────────

export async function addPicPlayer(
  eventId: string,
  name: string,
): Promise<{ id: string } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const { data: ev } = await svc
    .from("pic_events")
    .select("owner_id")
    .eq("id", eventId)
    .single();
  if (!ev || ev.owner_id !== user.id) return { error: "unauthorized" };

  const { data: p, error } = await svc
    .from("pic_players")
    .insert({ event_id: eventId, name: name.trim() })
    .select("id")
    .single();
  if (error || !p) return { error: error?.message ?? "add_failed" };

  revalidatePath(`/pic`);
  return { id: p.id };
}

export async function removePicPlayer(
  eventId: string,
  playerId: string,
): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const { data: ev } = await svc
    .from("pic_events")
    .select("owner_id")
    .eq("id", eventId)
    .single();
  if (!ev || ev.owner_id !== user.id) return { error: "unauthorized" };

  const { error } = await svc
    .from("pic_players")
    .delete()
    .eq("id", playerId)
    .eq("event_id", eventId);
  if (error) return { error: error.message };

  revalidatePath(`/pic`);
  return { ok: true };
}

export async function bulkAddPicPlayers(
  eventId: string,
  names: string[],
): Promise<{ count: number } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const { data: ev } = await svc
    .from("pic_events")
    .select("owner_id")
    .eq("id", eventId)
    .single();
  if (!ev || ev.owner_id !== user.id) return { error: "unauthorized" };

  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (!trimmed.length) return { count: 0 };

  const { data, error } = await svc
    .from("pic_players")
    .insert(trimmed.map((name) => ({ event_id: eventId, name })))
    .select("id");
  if (error) return { error: error.message };

  revalidatePath(`/pic`);
  return { count: data?.length ?? 0 };
}

// ── Generate group schedule ────────────────────────────────────────────────────

export async function generatePicGroups(
  eventId: string,
  groupCount: number,
  advancePerGroup: number,
): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const { data: ev } = await svc
    .from("pic_events")
    .select("owner_id, config")
    .eq("id", eventId)
    .single();
  if (!ev || ev.owner_id !== user.id) return { error: "unauthorized" };

  const { data: existingGroups } = await svc
    .from("pic_groups")
    .select("id")
    .eq("event_id", eventId);
  if (existingGroups && existingGroups.length > 0)
    return { error: "schedule_already_generated" };

  const { data: players } = await svc
    .from("pic_players")
    .select("id")
    .eq("event_id", eventId);
  if (!players || players.length < 4) return { error: "need_at_least_4_players" };

  // Random shuffle
  const ids = players.map((p) => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }

  const groupSlots = snakeDistribute(ids, groupCount);

  for (let gi = 0; gi < groupSlots.length; gi++) {
    const label = String.fromCharCode(65 + gi);
    const { data: grp, error: grpErr } = await svc
      .from("pic_groups")
      .insert({ event_id: eventId, label })
      .select("id")
      .single();
    if (grpErr || !grp) return { error: grpErr?.message ?? "group_failed" };

    const slotIds = groupSlots[gi]!;
    await svc.from("pic_group_players").insert(
      slotIds.map((pid, seed) => ({ group_id: grp.id, player_id: pid, seed })),
    );

    const n = slotIds.length;
    if (n < 4) continue;
    const schedule = generateGroupSchedule(Math.min(n, 8));
    await svc.from("pic_matches").insert(
      schedule.map((slot, i) => ({
        event_id: eventId,
        group_id: grp.id,
        round: i + 1,
        stage: "group",
        a1_id: slotIds[slot.a[0]]!,
        a2_id: slotIds[slot.a[1]]!,
        b1_id: slotIds[slot.b[0]]!,
        b2_id: slotIds[slot.b[1]]!,
      })),
    );
  }

  // Update advancePerGroup in config
  const cfg = ev.config as Record<string, unknown>;
  await svc
    .from("pic_events")
    .update({
      config: { ...cfg, advancePerGroup },
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  revalidatePath(`/pic`);
  return { ok: true };
}

// ── Score a match ──────────────────────────────────────────────────────────────

export async function scorePicMatch({
  eventId,
  matchId,
  scoreA,
  scoreB,
  token,
}: {
  eventId: string;
  matchId: string;
  scoreA: number;
  scoreB: number;
  token?: string;
}): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();

  // Auth: token (referee) or owner
  if (token) {
    const { data: ev } = await svc
      .from("pic_events")
      .select("id, referee_token")
      .eq("id", eventId)
      .single();
    if (!ev || ev.referee_token !== token) return { error: "invalid_token" };
  } else {
    const { user } = await requireUser();
    const { data: ev } = await svc
      .from("pic_events")
      .select("owner_id")
      .eq("id", eventId)
      .single();
    if (!ev || ev.owner_id !== user.id) return { error: "unauthorized" };
  }

  // Score the match
  const { error: upErr } = await svc
    .from("pic_matches")
    .update({
      score_a: scoreA,
      score_b: scoreB,
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .eq("event_id", eventId);
  if (upErr) return { error: upErr.message };

  // Load match stage for transition logic
  const { data: match } = await svc
    .from("pic_matches")
    .select("stage")
    .eq("id", matchId)
    .single();
  if (!match) return { error: "match_not_found" };

  if (match.stage === "group") {
    const { data: all } = await svc
      .from("pic_matches")
      .select("status")
      .eq("event_id", eventId)
      .eq("stage", "group");
    if (all?.every((m) => m.status === "completed")) {
      await svc
        .from("pic_events")
        .update({ stage: "draw", updated_at: new Date().toISOString() })
        .eq("id", eventId);
    }
  } else if (match.stage === "semifinal") {
    const { data: semis } = await svc
      .from("pic_matches")
      .select("*")
      .eq("event_id", eventId)
      .eq("stage", "semifinal");
    if (semis && semis.length >= 2 && semis.every((m) => m.status === "completed")) {
      const finalM = await svc
        .from("pic_matches")
        .select("id, a1_id")
        .eq("event_id", eventId)
        .eq("stage", "final")
        .maybeSingle();
      if (finalM.data && !finalM.data.a1_id) {
        const winners = semis.map((m) =>
          m.score_a > m.score_b
            ? [m.a1_id, m.a2_id]
            : [m.b1_id, m.b2_id],
        );
        const losers = semis.map((m) =>
          m.score_a > m.score_b
            ? [m.b1_id, m.b2_id]
            : [m.a1_id, m.a2_id],
        );
        await svc
          .from("pic_matches")
          .update({
            a1_id: winners[0]![0],
            a2_id: winners[0]![1],
            b1_id: winners[1]![0],
            b2_id: winners[1]![1],
          })
          .eq("id", finalM.data.id);

        const thirdM = await svc
          .from("pic_matches")
          .select("id")
          .eq("event_id", eventId)
          .eq("stage", "third")
          .maybeSingle();
        if (thirdM.data) {
          await svc
            .from("pic_matches")
            .update({
              a1_id: losers[0]![0],
              a2_id: losers[0]![1],
              b1_id: losers[1]![0],
              b2_id: losers[1]![1],
            })
            .eq("id", thirdM.data.id);
        }
      }
    }
  } else if (match.stage === "final" || match.stage === "third") {
    const { data: ev } = await svc
      .from("pic_events")
      .select("config")
      .eq("id", eventId)
      .single();
    const hasThird = (ev?.config as Record<string, unknown>)?.hasThirdPlace ?? false;
    const { data: ko } = await svc
      .from("pic_matches")
      .select("stage, status")
      .eq("event_id", eventId)
      .neq("stage", "group");
    const relevant = hasThird ? ko ?? [] : (ko ?? []).filter((m) => m.stage !== "third");
    if (relevant.every((m) => m.status === "completed")) {
      await svc
        .from("pic_events")
        .update({ stage: "done", updated_at: new Date().toISOString() })
        .eq("id", eventId);
    }
  }

  revalidatePath(`/pic/${eventId}`);
  return { ok: true };
}

// ── Draw knockout bracket ──────────────────────────────────────────────────────

export async function picDrawKnockout(
  eventId: string,
  pairs: [string, string][],
): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const { data: ev } = await svc
    .from("pic_events")
    .select("owner_id, config")
    .eq("id", eventId)
    .single();
  if (!ev || ev.owner_id !== user.id) return { error: "unauthorized" };
  const hasThird = (ev.config as Record<string, unknown>)?.hasThirdPlace ?? false;

  const matches: {
    event_id: string;
    round: number;
    stage: string;
    a1_id?: string | null;
    a2_id?: string | null;
    b1_id?: string | null;
    b2_id?: string | null;
  }[] = [];

  if (pairs.length === 2) {
    // Direct final
    matches.push({
      event_id: eventId,
      round: 1,
      stage: "final",
      a1_id: pairs[0]![0],
      a2_id: pairs[0]![1],
      b1_id: pairs[1]![0],
      b2_id: pairs[1]![1],
    });
  } else {
    // Semis (pairs 0v1, 2v3) + final + optional 3rd
    for (let i = 0; i < pairs.length - 1; i += 2) {
      matches.push({
        event_id: eventId,
        round: i / 2 + 1,
        stage: "semifinal",
        a1_id: pairs[i]![0],
        a2_id: pairs[i]![1],
        b1_id: pairs[i + 1]![0],
        b2_id: pairs[i + 1]![1],
      });
    }
    // Final and 3rd — player slots filled after semis
    matches.push({ event_id: eventId, round: 99, stage: "final" });
    if (hasThird) {
      matches.push({ event_id: eventId, round: 98, stage: "third" });
    }
  }

  const { error } = await svc.from("pic_matches").insert(matches);
  if (error) return { error: error.message };

  await svc
    .from("pic_events")
    .update({ stage: "knockout", updated_at: new Date().toISOString() })
    .eq("id", eventId);

  revalidatePath(`/pic/${eventId}`);
  return { ok: true };
}

// ── Realtime group draw via pair_sessions ─────────────────────────────────────

export async function createPicDraw(
  eventId: string,
  groupCount: number,
  advancePerGroup: number,
): Promise<{ code: string; hostToken: string } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const { data: ev } = await svc
    .from("pic_events")
    .select("owner_id, config")
    .eq("id", eventId)
    .single();
  if (!ev || ev.owner_id !== user.id) return { error: "unauthorized" };

  const cfg = (ev.config as Record<string, unknown>) ?? {};
  if (cfg.drawCode) return { error: "draw_exists" };

  const { data: playersData } = await svc
    .from("pic_players")
    .select("id, name")
    .eq("event_id", eventId);
  const players = playersData ?? [];
  if (players.length < 4) return { error: "Cần ít nhất 4 VĐV" };

  const groupSize = Math.floor(players.length / groupCount);
  const title = ((cfg.name as string) ?? "Bốc thăm PIC").slice(0, 100);
  const participants = players.map((p) => ({ id: p.id, name: p.name, joinedAt: Date.now() }));

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomBytes(3).toString("hex");
    const hostToken = randomBytes(24).toString("base64url");
    const { error: insertErr } = await svc.from("pair_sessions").insert({
      code,
      host_token: hostToken,
      title,
      group_size: groupSize,
      participants,
      status: "locked",
      expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    });
    if (!insertErr) {
      await svc
        .from("pic_events")
        .update({ config: { ...cfg, drawCode: code, drawGroupCount: groupCount, drawAdvancePerGroup: advancePerGroup } })
        .eq("id", eventId);
      revalidatePath(`/pic/${eventId}`);
      return { code, hostToken };
    }
    if (!insertErr.message.toLowerCase().includes("duplicate")) return { error: insertErr.message };
  }
  return { error: "Trùng mã liên tiếp" };
}

export async function applyPicDraw(
  eventId: string,
): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const { data: ev } = await svc
    .from("pic_events")
    .select("owner_id, config")
    .eq("id", eventId)
    .single();
  if (!ev || ev.owner_id !== user.id) return { error: "unauthorized" };

  const cfg = (ev.config as Record<string, unknown>) ?? {};
  const drawCode = cfg.drawCode as string | undefined | null;
  const groupCount = (cfg.drawGroupCount as number) ?? 1;
  const advancePerGroup = (cfg.drawAdvancePerGroup as number) ?? 1;
  if (!drawCode) return { error: "no_draw" };

  // Idempotency: skip if groups already created
  const { data: existingGroups } = await svc
    .from("pic_groups")
    .select("id")
    .eq("event_id", eventId)
    .limit(1);
  if (existingGroups && existingGroups.length > 0) return { ok: true };

  const { data: session } = await svc
    .from("pair_sessions")
    .select("result, status")
    .eq("code", drawCode)
    .single();
  if (!session) return { error: "draw_not_found" };
  if (session.status !== "shuffled" && session.status !== "locked") return { error: "not_shuffled" };

  const result = session.result as { groups: string[][]; byes: string[] } | null;
  if (!result || result.groups.length === 0) return { error: "no_result" };

  // Build final group slots: start from pair session groups, distribute byes
  const groupSlots: string[][] = result.groups.map((g) => [...g]);
  for (const byeId of result.byes ?? []) {
    let minIdx = 0;
    for (let i = 1; i < groupSlots.length; i++) {
      if (groupSlots[i]!.length < groupSlots[minIdx]!.length) minIdx = i;
    }
    groupSlots[minIdx]!.push(byeId);
  }

  const labels = "ABCDEFGH";
  for (let gi = 0; gi < groupSlots.length; gi++) {
    const label = labels[gi] ?? String(gi + 1);
    const slotIds = groupSlots[gi]!;

    const { data: grp, error: grpErr } = await svc
      .from("pic_groups")
      .insert({ event_id: eventId, label })
      .select("id")
      .single();
    if (grpErr || !grp) return { error: grpErr?.message ?? "group_failed" };

    await svc.from("pic_group_players").insert(
      slotIds.map((pid, seed) => ({ group_id: grp.id, player_id: pid, seed })),
    );

    const n = slotIds.length;
    if (n < 4) continue;
    const schedule = generateGroupSchedule(Math.min(n, 8));
    await svc.from("pic_matches").insert(
      schedule.map((slot, i) => ({
        event_id: eventId,
        group_id: grp.id,
        round: i + 1,
        stage: "group",
        a1_id: slotIds[slot.a[0]]!,
        a2_id: slotIds[slot.a[1]]!,
        b1_id: slotIds[slot.b[0]]!,
        b2_id: slotIds[slot.b[1]]!,
      })),
    );
  }

  await svc
    .from("pic_events")
    .update({ config: { ...cfg, drawCode: null, advancePerGroup }, updated_at: new Date().toISOString() })
    .eq("id", eventId);

  revalidatePath(`/pic/${eventId}`);
  return { ok: true };
}

// ── Create quick_scores entry for a PIC match ─────────────────────────────────

export async function createPicMatchScore({
  teamAName,
  teamBName,
  targetPoints,
  title,
}: {
  teamAName: string;
  teamBName: string;
  targetPoints: number;
  title: string;
}): Promise<{ code: string } | { error: string }> {
  const svc = createServiceClient();
  for (let i = 0; i < 5; i++) {
    const code = randomBytes(6).toString("base64url");
    const { error } = await svc.from("quick_scores").insert({
      code,
      team_a_name: teamAName.slice(0, 80),
      team_b_name: teamBName.slice(0, 80),
      target_points: targetPoints,
      title: title.slice(0, 120),
    });
    if (!error) return { code };
    if (!error.message.toLowerCase().includes("duplicate")) return { error: error.message };
  }
  return { error: "Trùng mã liên tiếp" };
}

// ── Referee token ──────────────────────────────────────────────────────────────

export async function getPicRefereeToken(
  eventId: string,
): Promise<{ token: string } | { error: string }> {
  const { user } = await requireUser();
  const svc = createServiceClient();

  const { data: ev } = await svc
    .from("pic_events")
    .select("owner_id, referee_token")
    .eq("id", eventId)
    .single();
  if (!ev || ev.owner_id !== user.id) return { error: "unauthorized" };
  if (ev.referee_token) return { token: ev.referee_token };

  const token = newToken();
  const { error } = await svc
    .from("pic_events")
    .update({ referee_token: token })
    .eq("id", eventId);
  if (error) return { error: error.message };
  return { token };
}
