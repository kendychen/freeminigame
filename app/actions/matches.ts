"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireTournamentAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export interface UpdateScoreInput {
  matchId: string;
  tournamentId: string;
  scoreA: number;
  scoreB: number;
}

export async function updateMatchScore(input: UpdateScoreInput) {
  if (input.scoreA < 0 || input.scoreB < 0) {
    return { error: "negative_score" } as const;
  }
  const { user, supabase } = await requireTournamentAdmin(input.tournamentId);
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", input.matchId)
    .single();
  if (!match) return { error: "not_found" } as const;
  if (match.tournament_id !== input.tournamentId) {
    return { error: "tournament_mismatch" } as const;
  }
  const winner =
    input.scoreA === input.scoreB
      ? null
      : input.scoreA > input.scoreB
        ? match.team_a_id
        : match.team_b_id;
  const status = winner ? "completed" : input.scoreA + input.scoreB > 0 ? "live" : "pending";

  const { error } = await supabase
    .from("matches")
    .update({
      score_a: input.scoreA,
      score_b: input.scoreB,
      winner_team_id: winner,
      status,
      updated_by: user.id,
    })
    .eq("id", input.matchId);
  if (error) return { error: error.message } as const;

  // Auto-advance for elim/group bracket (incl. plate / Cúp phụ)
  if (
    winner &&
    (match.bracket === "main" ||
      match.bracket === "plate" ||
      match.bracket === "winners" ||
      match.bracket === "losers")
  ) {
    if (match.next_win_match_id) {
      await advanceTeamIntoMatch(supabase, match.next_win_match_id, winner);
    }
    if (match.next_loss_match_id) {
      const loser =
        winner === match.team_a_id ? match.team_b_id : match.team_a_id;
      if (loser) {
        await advanceTeamIntoMatch(supabase, match.next_loss_match_id, loser);
      }
    }
  }
  revalidatePath(`/t`, "layout");
  return { ok: true } as const;
}

async function advanceTeamIntoMatch(
  supabase: Awaited<ReturnType<typeof requireTournamentAdmin>>["supabase"],
  matchId: string,
  teamId: string,
) {
  const { data: target } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id")
    .eq("id", matchId)
    .single();
  if (!target) return;
  if (target.team_a_id === teamId || target.team_b_id === teamId) return;
  if (!target.team_a_id) {
    await supabase.from("matches").update({ team_a_id: teamId }).eq("id", matchId);
  } else if (!target.team_b_id) {
    await supabase.from("matches").update({ team_b_id: teamId }).eq("id", matchId);
  }
}

/**
 * Atomic +/- score increment for referee mode.
 * Reads current row, applies delta, then writes.
 *
 * Does NOT declare a winner from the score — completion is explicit via
 * `finalizeMatch`. Status flips to 'live' once any score > 0, otherwise
 * stays 'pending'. If the match was already completed, scores can still
 * be tweaked but status remains 'completed'.
 */
export async function incrementScore(input: {
  matchId: string;
  tournamentId: string;
  side: "a" | "b";
  delta: number;
}) {
  const { user, supabase } = await requireTournamentAdmin(input.tournamentId);
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", input.matchId)
    .single();
  if (!match) return { error: "not_found" } as const;
  if (match.tournament_id !== input.tournamentId) {
    return { error: "tournament_mismatch" } as const;
  }

  const nextA = Math.max(
    0,
    (match.score_a as number) + (input.side === "a" ? input.delta : 0),
  );
  const nextB = Math.max(
    0,
    (match.score_b as number) + (input.side === "b" ? input.delta : 0),
  );

  const wasCompleted = match.status === "completed";
  const status = wasCompleted
    ? "completed"
    : nextA + nextB > 0
      ? "live"
      : "pending";

  const { error } = await supabase
    .from("matches")
    .update({
      score_a: nextA,
      score_b: nextB,
      status,
      updated_by: user.id,
    })
    .eq("id", input.matchId);
  if (error) return { error: error.message } as const;

  return {
    ok: true,
    scoreA: nextA,
    scoreB: nextB,
    status,
    winner: match.winner_team_id ?? null,
  } as const;
}

/**
 * Explicit match-finalize. Picks the winner from the current scores
 * (or rejects if tied), sets status='completed', and advances winner/loser
 * into the next bracket slot.
 */
export async function finalizeMatch(input: {
  matchId: string;
  tournamentId: string;
}) {
  const { user, supabase } = await requireTournamentAdmin(input.tournamentId);
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", input.matchId)
    .single();
  if (!match) return { error: "not_found" } as const;
  if (match.tournament_id !== input.tournamentId) {
    return { error: "tournament_mismatch" } as const;
  }
  const a = match.score_a as number;
  const b = match.score_b as number;
  if (a === b) return { error: "tie_score" } as const;
  const winner = a > b ? match.team_a_id : match.team_b_id;
  if (!winner) return { error: "missing_team" } as const;

  const { error } = await supabase
    .from("matches")
    .update({
      status: "completed",
      winner_team_id: winner,
      updated_by: user.id,
    })
    .eq("id", input.matchId);
  if (error) return { error: error.message } as const;

  if (
    match.bracket === "main" ||
    match.bracket === "plate" ||
    match.bracket === "winners" ||
    match.bracket === "losers"
  ) {
    if (match.next_win_match_id) {
      await advanceTeamIntoMatch(supabase, match.next_win_match_id, winner);
    }
    if (match.next_loss_match_id) {
      const loser =
        winner === match.team_a_id ? match.team_b_id : match.team_a_id;
      if (loser) {
        await advanceTeamIntoMatch(supabase, match.next_loss_match_id, loser);
      }
    }
  }
  return { ok: true, winner } as const;
}

/** Reopen a completed match for re-scoring (clears winner, keeps scores). */
export async function reopenMatch(input: {
  matchId: string;
  tournamentId: string;
}) {
  const { user, supabase } = await requireTournamentAdmin(input.tournamentId);
  const { data: match } = await supabase
    .from("matches")
    .select("score_a, score_b, tournament_id")
    .eq("id", input.matchId)
    .single();
  if (!match) return { error: "not_found" } as const;
  if (match.tournament_id !== input.tournamentId) {
    return { error: "tournament_mismatch" } as const;
  }
  const status =
    (match.score_a as number) + (match.score_b as number) > 0
      ? "live"
      : "pending";
  const { error } = await supabase
    .from("matches")
    .update({
      status,
      winner_team_id: null,
      updated_by: user.id,
    })
    .eq("id", input.matchId);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

export async function recordMatchSet(input: {
  tournamentId: string;
  matchId: string;
  setNumber: number;
  scoreA: number;
  scoreB: number;
}) {
  const { user, supabase } = await requireTournamentAdmin(input.tournamentId);
  const { data: m } = await supabase
    .from("matches")
    .select("team_a_id, team_b_id")
    .eq("id", input.matchId)
    .single();
  if (!m) return { error: "match_not_found" } as const;
  const winner =
    input.scoreA === input.scoreB
      ? null
      : input.scoreA > input.scoreB
        ? m.team_a_id
        : m.team_b_id;
  const { error } = await supabase
    .from("match_sets")
    .upsert(
      {
        match_id: input.matchId,
        set_number: input.setNumber,
        score_a: input.scoreA,
        score_b: input.scoreB,
        winner_team_id: winner,
      },
      { onConflict: "match_id,set_number" },
    );
  if (error) return { error: error.message } as const;
  await supabase
    .from("matches")
    .update({ updated_by: user.id })
    .eq("id", input.matchId);
  return { ok: true } as const;
}

// ─────────────────────────────────────────────────────────────────────
// Anonymous referee share-link
// ─────────────────────────────────────────────────────────────────────

function newRefereeToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Admin: get-or-create referee token for a match. */
export async function getOrCreateRefereeToken(input: {
  tournamentId: string;
  matchId: string;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const { data: m } = await supabase
    .from("matches")
    .select("id, referee_token, tournament_id")
    .eq("id", input.matchId)
    .single();
  if (!m) return { error: "match_not_found" } as const;
  if (m.tournament_id !== input.tournamentId) {
    return { error: "tournament_mismatch" } as const;
  }
  if (m.referee_token) return { ok: true, token: m.referee_token } as const;
  const token = newRefereeToken();
  const { error } = await supabase
    .from("matches")
    .update({ referee_token: token })
    .eq("id", input.matchId);
  if (error) return { error: error.message } as const;
  return { ok: true, token } as const;
}

/** Admin: revoke referee token (cuts off any open referee session). */
export async function revokeRefereeToken(input: {
  tournamentId: string;
  matchId: string;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const { error } = await supabase
    .from("matches")
    .update({ referee_token: null })
    .eq("id", input.matchId)
    .eq("tournament_id", input.tournamentId);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

/** Atomic helper: looks up match by token via service role, applies a score
 * mutation, and runs auto-advance. Returns the updated match data. */
async function mutateMatchByToken(
  token: string,
  mutate: (m: {
    score_a: number;
    score_b: number;
    team_a_id: string | null;
    team_b_id: string | null;
  }) => { scoreA: number; scoreB: number },
) {
  if (!token || token.length < 16 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return { error: "invalid_token" } as const;
  }
  const svc = createServiceClient();
  const { data: match } = await svc
    .from("matches")
    .select("*")
    .eq("referee_token", token)
    .maybeSingle();
  if (!match) return { error: "invalid_token" } as const;

  // Confirm tournament is alive (refuse on archived/deleted)
  const { data: t } = await svc
    .from("tournaments")
    .select("id, deleted_at")
    .eq("id", match.tournament_id)
    .maybeSingle();
  if (!t || t.deleted_at) return { error: "tournament_not_found" } as const;

  const { scoreA, scoreB } = mutate({
    score_a: match.score_a as number,
    score_b: match.score_b as number,
    team_a_id: match.team_a_id as string | null,
    team_b_id: match.team_b_id as string | null,
  });
  if (scoreA < 0 || scoreB < 0) return { error: "negative_score" } as const;

  // Increment never auto-completes; finalize is explicit (publicFinalizeByToken).
  const wasCompleted = match.status === "completed";
  const status = wasCompleted
    ? "completed"
    : scoreA + scoreB > 0
      ? "live"
      : "pending";

  const { error } = await svc
    .from("matches")
    .update({
      score_a: scoreA,
      score_b: scoreB,
      status,
    })
    .eq("id", match.id);
  if (error) return { error: error.message } as const;

  return {
    ok: true,
    scoreA,
    scoreB,
    status,
    winner: match.winner_team_id ?? null,
  } as const;
}

async function advanceTeamIntoMatchSvc(
  svc: ReturnType<typeof createServiceClient>,
  matchId: string,
  teamId: string,
) {
  const { data: target } = await svc
    .from("matches")
    .select("id, team_a_id, team_b_id")
    .eq("id", matchId)
    .single();
  if (!target) return;
  if (target.team_a_id === teamId || target.team_b_id === teamId) return;
  if (!target.team_a_id) {
    await svc.from("matches").update({ team_a_id: teamId }).eq("id", matchId);
  } else if (!target.team_b_id) {
    await svc.from("matches").update({ team_b_id: teamId }).eq("id", matchId);
  }
}

/** Public: increment a score by referee token. */
export async function publicIncrementByToken(input: {
  token: string;
  side: "a" | "b";
  delta: number;
}) {
  return mutateMatchByToken(input.token, (m) => ({
    scoreA: Math.max(
      0,
      m.score_a + (input.side === "a" ? input.delta : 0),
    ),
    scoreB: Math.max(
      0,
      m.score_b + (input.side === "b" ? input.delta : 0),
    ),
  }));
}

/** Public: reset both scores to 0-0 by referee token. */
export async function publicResetByToken(input: { token: string }) {
  return mutateMatchByToken(input.token, () => ({ scoreA: 0, scoreB: 0 }));
}

/** Public: explicit finalize for the legacy per-match token. */
export async function publicFinalizeByToken(input: { token: string }) {
  if (
    !input.token ||
    input.token.length < 16 ||
    !/^[A-Za-z0-9_-]+$/.test(input.token)
  ) {
    return { error: "invalid_token" } as const;
  }
  const svc = createServiceClient();
  const { data: match } = await svc
    .from("matches")
    .select("*")
    .eq("referee_token", input.token)
    .maybeSingle();
  if (!match) return { error: "invalid_token" } as const;
  const a = match.score_a as number;
  const b = match.score_b as number;
  if (a === b) return { error: "tie_score" } as const;
  const winner = a > b ? match.team_a_id : match.team_b_id;
  if (!winner) return { error: "missing_team" } as const;
  const { error } = await svc
    .from("matches")
    .update({ status: "completed", winner_team_id: winner })
    .eq("id", match.id);
  if (error) return { error: error.message } as const;
  if (
    match.bracket === "main" ||
    match.bracket === "plate" ||
    match.bracket === "winners" ||
    match.bracket === "losers"
  ) {
    if (match.next_win_match_id) {
      await advanceTeamIntoMatchSvc(svc, match.next_win_match_id, winner);
    }
    if (match.next_loss_match_id) {
      const loser =
        winner === match.team_a_id ? match.team_b_id : match.team_a_id;
      if (loser) {
        await advanceTeamIntoMatchSvc(svc, match.next_loss_match_id, loser);
      }
    }
  }
  return { ok: true, winner } as const;
}

/** Public: reopen completed match for legacy per-match token. */
export async function publicReopenByToken(input: { token: string }) {
  if (
    !input.token ||
    input.token.length < 16 ||
    !/^[A-Za-z0-9_-]+$/.test(input.token)
  ) {
    return { error: "invalid_token" } as const;
  }
  const svc = createServiceClient();
  const { data: match } = await svc
    .from("matches")
    .select("id, score_a, score_b")
    .eq("referee_token", input.token)
    .maybeSingle();
  if (!match) return { error: "invalid_token" } as const;
  const status =
    (match.score_a as number) + (match.score_b as number) > 0
      ? "live"
      : "pending";
  const { error } = await svc
    .from("matches")
    .update({ status, winner_team_id: null })
    .eq("id", match.id);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

// ─────────────────────────────────────────────────────────────────────
// Scoped referee tokens (per-group / per-bracket)
// ─────────────────────────────────────────────────────────────────────

/** Admin: get-or-create a scoped referee token (group | bracket | match). */
export async function getOrCreateScopedRefereeToken(input: {
  tournamentId: string;
  scope: "group" | "bracket" | "match";
  scopeValue: string;
}) {
  const { user, supabase } = await requireTournamentAdmin(input.tournamentId);
  if (!input.scopeValue) return { error: "missing_id" } as const;
  const { data: existing } = await supabase
    .from("referee_tokens")
    .select("token")
    .eq("tournament_id", input.tournamentId)
    .eq("scope", input.scope)
    .eq("scope_value", input.scopeValue)
    .is("revoked_at", null)
    .maybeSingle();
  if (existing?.token) return { ok: true, token: existing.token } as const;
  const token = newRefereeToken();
  const { error } = await supabase.from("referee_tokens").insert({
    token,
    tournament_id: input.tournamentId,
    scope: input.scope,
    scope_value: input.scopeValue,
    created_by: user.id,
  });
  if (error) return { error: error.message } as const;
  return { ok: true, token } as const;
}

/** Convenience wrapper for group scope (kept for backward compatibility). */
export async function getOrCreateGroupRefereeToken(input: {
  tournamentId: string;
  groupLabel: string;
}) {
  return getOrCreateScopedRefereeToken({
    tournamentId: input.tournamentId,
    scope: "group",
    scopeValue: input.groupLabel,
  });
}

/** Admin: revoke a scoped token. */
export async function revokeScopedRefereeToken(input: {
  tournamentId: string;
  token: string;
}) {
  const { supabase } = await requireTournamentAdmin(input.tournamentId);
  const { error } = await supabase
    .from("referee_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", input.token)
    .eq("tournament_id", input.tournamentId);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

/**
 * Internal: validate a scoped token and return (tournament_id, scope, scope_value)
 * if it's still alive. Used by the public route + score-mutation actions.
 */
async function lookupScopedToken(token: string) {
  if (!token || token.length < 16 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return null;
  }
  const svc = createServiceClient();
  const { data } = await svc
    .from("referee_tokens")
    .select("token, tournament_id, scope, scope_value")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();
  return data ?? null;
}

/** Internal: confirm `matchId` is in scope of the given alive scoped token. */
async function matchInScope(
  scoped: { tournament_id: string; scope: string; scope_value: string },
  matchId: string,
) {
  const svc = createServiceClient();
  const { data: m } = await svc
    .from("matches")
    .select("id, tournament_id, group_label, bracket")
    .eq("id", matchId)
    .maybeSingle();
  if (!m || m.tournament_id !== scoped.tournament_id) return null;
  if (scoped.scope === "group" && m.group_label === scoped.scope_value) return m;
  if (scoped.scope === "bracket" && m.bracket === scoped.scope_value) return m;
  if (scoped.scope === "match" && m.id === scoped.scope_value) return m;
  return null;
}

/** Public: increment a score on a specific match using a scoped token. */
export async function publicIncrementByScopedToken(input: {
  token: string;
  matchId: string;
  side: "a" | "b";
  delta: number;
}) {
  const scoped = await lookupScopedToken(input.token);
  if (!scoped) return { error: "invalid_token" } as const;
  const m = await matchInScope(scoped, input.matchId);
  if (!m) return { error: "match_not_in_scope" } as const;

  const svc = createServiceClient();
  const { data: match } = await svc
    .from("matches")
    .select("*")
    .eq("id", input.matchId)
    .single();
  if (!match) return { error: "not_found" } as const;

  const nextA = Math.max(
    0,
    (match.score_a as number) + (input.side === "a" ? input.delta : 0),
  );
  const nextB = Math.max(
    0,
    (match.score_b as number) + (input.side === "b" ? input.delta : 0),
  );
  // Increment never auto-completes; finalize is explicit.
  const wasCompleted = match.status === "completed";
  const status = wasCompleted
    ? "completed"
    : nextA + nextB > 0
      ? "live"
      : "pending";

  const { error } = await svc
    .from("matches")
    .update({
      score_a: nextA,
      score_b: nextB,
      status,
    })
    .eq("id", input.matchId);
  if (error) return { error: error.message } as const;

  return {
    ok: true,
    scoreA: nextA,
    scoreB: nextB,
    status,
    winner: match.winner_team_id ?? null,
  } as const;
}

/** Public: explicit finalize of a match using a scoped token. */
export async function publicFinalizeByScopedToken(input: {
  token: string;
  matchId: string;
}) {
  const scoped = await lookupScopedToken(input.token);
  if (!scoped) return { error: "invalid_token" } as const;
  const m = await matchInScope(scoped, input.matchId);
  if (!m) return { error: "match_not_in_scope" } as const;
  const svc = createServiceClient();
  const { data: match } = await svc
    .from("matches")
    .select("*")
    .eq("id", input.matchId)
    .single();
  if (!match) return { error: "not_found" } as const;
  const a = match.score_a as number;
  const b = match.score_b as number;
  if (a === b) return { error: "tie_score" } as const;
  const winner = a > b ? match.team_a_id : match.team_b_id;
  if (!winner) return { error: "missing_team" } as const;
  const { error } = await svc
    .from("matches")
    .update({ status: "completed", winner_team_id: winner })
    .eq("id", input.matchId);
  if (error) return { error: error.message } as const;
  if (
    match.bracket === "main" ||
    match.bracket === "plate" ||
    match.bracket === "winners" ||
    match.bracket === "losers"
  ) {
    if (match.next_win_match_id) {
      await advanceTeamIntoMatchSvc(svc, match.next_win_match_id, winner);
    }
    if (match.next_loss_match_id) {
      const loser =
        winner === match.team_a_id ? match.team_b_id : match.team_a_id;
      if (loser) {
        await advanceTeamIntoMatchSvc(svc, match.next_loss_match_id, loser);
      }
    }
  }
  return { ok: true, winner } as const;
}

/** Public: reopen completed match for a scoped token. */
export async function publicReopenByScopedToken(input: {
  token: string;
  matchId: string;
}) {
  const scoped = await lookupScopedToken(input.token);
  if (!scoped) return { error: "invalid_token" } as const;
  const m = await matchInScope(scoped, input.matchId);
  if (!m) return { error: "match_not_in_scope" } as const;
  const svc = createServiceClient();
  const { data: match } = await svc
    .from("matches")
    .select("score_a, score_b")
    .eq("id", input.matchId)
    .single();
  if (!match) return { error: "not_found" } as const;
  const status =
    (match.score_a as number) + (match.score_b as number) > 0
      ? "live"
      : "pending";
  const { error } = await svc
    .from("matches")
    .update({ status, winner_team_id: null })
    .eq("id", input.matchId);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}

/** Public: reset a specific match to 0-0 using a scoped token. */
export async function publicResetByScopedToken(input: {
  token: string;
  matchId: string;
}) {
  const scoped = await lookupScopedToken(input.token);
  if (!scoped) return { error: "invalid_token" } as const;
  const m = await matchInScope(scoped, input.matchId);
  if (!m) return { error: "match_not_in_scope" } as const;
  const svc = createServiceClient();
  const { error } = await svc
    .from("matches")
    .update({
      score_a: 0,
      score_b: 0,
      winner_team_id: null,
      status: "pending",
    })
    .eq("id", input.matchId);
  if (error) return { error: error.message } as const;
  return { ok: true } as const;
}
