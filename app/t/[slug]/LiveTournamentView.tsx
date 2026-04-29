"use client";

import { useMemo, useState } from "react";
import { BracketView } from "@/components/bracket/BracketView";
import { ScheduleView } from "@/components/tournaments/ScheduleView";
import { StandingsTable } from "@/components/tournaments/StandingsTable";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import type { DbMatch, DbTeam, DbTournament } from "@/types/database";
import type { Match, Team } from "@/lib/pairing/types";
import type { TieBreakerConfig } from "@/lib/standings/types";

type Tab = "bracket" | "schedule" | "standings";

interface LiveProps {
  tournament: DbTournament;
  teams: DbTeam[];
  initialMatches: DbMatch[];
  onMatchClick?: (matchId: string) => void;
}

export function LiveTournamentView({
  tournament,
  teams,
  initialMatches,
  onMatchClick,
}: LiveProps) {
  const liveMatches = useLiveMatches(tournament.id, initialMatches);
  const [activeTab, setActiveTab] = useState<Tab>("bracket");

  const isElim =
    tournament.format === "single_elim" || tournament.format === "double_elim";
  const isGroupKO = tournament.format === "group_knockout";

  const teamsTyped: Team[] = useMemo(
    () =>
      teams.map((t) => ({
        id: t.id,
        name: t.name,
        seed: t.seed ?? undefined,
        rating: t.rating ?? undefined,
        region: t.region ?? undefined,
        logoUrl: t.logo_url ?? undefined,
      })),
    [teams],
  );
  const matchesTyped: Match[] = useMemo(
    () =>
      liveMatches.map((m) => ({
        id: m.id,
        round: m.round,
        matchNumber: m.match_number,
        bracket: m.bracket,
        groupLabel: m.group_label ?? undefined,
        teamA: m.team_a_id,
        teamB: m.team_b_id,
        scoreA: m.score_a,
        scoreB: m.score_b,
        winner: m.winner_team_id,
        status: m.status,
        nextWinId: m.next_win_match_id ?? undefined,
        nextLossId: m.next_loss_match_id ?? undefined,
      })),
    [liveMatches],
  );

  const cfg = (tournament.config ?? {}) as { tiebreakers?: TieBreakerConfig[]; randomSeed?: number };
  const tiebreakers = cfg.tiebreakers;
  const randomSeed = cfg.randomSeed ?? 0;

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: "bracket", label: "Bảng đấu", show: isElim || isGroupKO },
    { id: "schedule", label: "Lịch", show: true },
    { id: "standings", label: "Bảng điểm", show: !isElim },
  ];

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm ${
                activeTab === t.id
                  ? "border-b-2 border-primary font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>
      {activeTab === "bracket" && (isElim || isGroupKO) && (
        <BracketView
          matches={
            isGroupKO
              ? matchesTyped.filter((m) => m.bracket === "main")
              : matchesTyped
          }
          teams={teamsTyped}
          variant={tournament.format === "double_elim" ? "double" : "single"}
          onMatchClick={onMatchClick}
        />
      )}
      {activeTab === "schedule" && (
        <ScheduleView
          teams={teamsTyped}
          matches={matchesTyped}
          onMatchClick={onMatchClick}
        />
      )}
      {activeTab === "standings" && !isElim && (
        <StandingsTable
          teams={teamsTyped}
          matches={matchesTyped}
          tiebreakers={tiebreakers}
          randomSeed={randomSeed}
        />
      )}
    </div>
  );
}
