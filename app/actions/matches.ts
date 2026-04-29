"use server";

import { revalidatePath } from "next/cache";
import { requireTournamentAdmin } from "@/lib/auth";

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

  // Auto-advance for elim/group bracket
  if (
    winner &&
    (match.bracket === "main" ||
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
