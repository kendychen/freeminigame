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
 * Reads current row, applies delta, then writes — same code path as updateMatchScore.
 * Concurrent referees on the same match: last write wins (acceptable for live scoring).
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

  const winner =
    nextA === nextB
      ? null
      : nextA > nextB
        ? match.team_a_id
        : match.team_b_id;
  const status = winner
    ? "completed"
    : nextA + nextB > 0
      ? "live"
      : "pending";

  const { error } = await supabase
    .from("matches")
    .update({
      score_a: nextA,
      score_b: nextB,
      winner_team_id: winner,
      status,
      updated_by: user.id,
    })
    .eq("id", input.matchId);
  if (error) return { error: error.message } as const;

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
  return {
    ok: true,
    scoreA: nextA,
    scoreB: nextB,
    status,
    winner,
  } as const;
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

  const winner =
    scoreA === scoreB
      ? null
      : scoreA > scoreB
        ? match.team_a_id
        : match.team_b_id;
  const status = winner
    ? "completed"
    : scoreA + scoreB > 0
      ? "live"
      : "pending";

  const { error } = await svc
    .from("matches")
    .update({
      score_a: scoreA,
      score_b: scoreB,
      winner_team_id: winner,
      status,
    })
    .eq("id", match.id);
  if (error) return { error: error.message } as const;

  if (
    winner &&
    (match.bracket === "main" ||
      match.bracket === "plate" ||
      match.bracket === "winners" ||
      match.bracket === "losers")
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
  return {
    ok: true,
    scoreA,
    scoreB,
    status,
    winner,
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
