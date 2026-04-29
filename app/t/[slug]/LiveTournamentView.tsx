"use client";

import { useMemo, useState } from "react";
import { BracketView } from "@/components/bracket/BracketView";
import { ScheduleView } from "@/components/tournaments/ScheduleView";
import { StandingsTable } from "@/components/tournaments/StandingsTable";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  subscribe?: boolean;
}

export function LiveTournamentView({
  tournament,
  teams,
  initialMatches,
  onMatchClick,
  subscribe = true,
}: LiveProps) {
  const subscribed = useLiveMatches(
    subscribe ? tournament.id : "",
    initialMatches,
  );
  const liveMatches = subscribe ? subscribed : initialMatches;
  const [activeTab, setActiveTab] = useState<Tab>("bracket");
  const [groupFilter, setGroupFilter] = useState<string>("ALL");

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

  // Map team_id -> group_label (from teams table)
  const teamGroupMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams) {
      if (t.group_label) m.set(t.id, t.group_label);
    }
    return m;
  }, [teams]);

  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    for (const t of teams) if (t.group_label) set.add(t.group_label);
    return Array.from(set).sort();
  }, [teams]);

  const matchesTyped: Match[] = useMemo(
    () =>
      liveMatches.map((m) => ({
        id: m.id,
        round: m.round,
        matchNumber: m.match_number,
        bracket: m.bracket,
        groupLabel:
          m.group_label ??
          // Derive from teams' group_label if both teams in same group
          ((m.team_a_id &&
            m.team_b_id &&
            teamGroupMap.get(m.team_a_id) === teamGroupMap.get(m.team_b_id) &&
            teamGroupMap.get(m.team_a_id)) ||
            undefined),
        teamA: m.team_a_id,
        teamB: m.team_b_id,
        scoreA: m.score_a,
        scoreB: m.score_b,
        winner: m.winner_team_id,
        status: m.status,
        nextWinId: m.next_win_match_id ?? undefined,
        nextLossId: m.next_loss_match_id ?? undefined,
      })),
    [liveMatches, teamGroupMap],
  );

  const cfg = (tournament.config ?? {}) as {
    tiebreakers?: TieBreakerConfig[];
    randomSeed?: number;
  };
  const tiebreakers = cfg.tiebreakers;
  const randomSeed = cfg.randomSeed ?? 0;

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: "bracket", label: "Bảng đấu", show: isElim || isGroupKO },
    { id: "schedule", label: "Lịch", show: true },
    { id: "standings", label: "Bảng điểm", show: !isElim },
  ];

  // Filter matches by selected group (when applicable)
  const filteredMatches = useMemo(() => {
    if (groupFilter === "ALL" || availableGroups.length === 0)
      return matchesTyped;
    return matchesTyped.filter((m) => m.groupLabel === groupFilter);
  }, [matchesTyped, groupFilter, availableGroups]);

  const filteredTeams = useMemo(() => {
    if (groupFilter === "ALL" || availableGroups.length === 0)
      return teamsTyped;
    return teamsTyped.filter((t) => teamGroupMap.get(t.id) === groupFilter);
  }, [teamsTyped, groupFilter, availableGroups, teamGroupMap]);

  const showGroupSelector =
    availableGroups.length > 0 &&
    (activeTab === "schedule" || activeTab === "standings");

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

      {showGroupSelector && (
        <div className="mb-4 flex items-center gap-2">
          <Label htmlFor="grpsel" className="text-sm">
            Chọn bảng:
          </Label>
          <Select
            id="grpsel"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="w-40"
          >
            <option value="ALL">Tất cả bảng</option>
            {availableGroups.map((g) => (
              <option key={g} value={g}>
                Bảng {g}
              </option>
            ))}
          </Select>
        </div>
      )}

      {activeTab === "bracket" &&
        (isElim || isGroupKO) &&
        (() => {
          if (isGroupKO) {
            const mainMatches = matchesTyped.filter(
              (m) => m.bracket === "main",
            );
            const groupMatches = matchesTyped.filter(
              (m) => m.bracket === "group",
            );
            if (mainMatches.length === 0 && groupMatches.length > 0) {
              return (
                <div className="rounded-lg border bg-card p-6 text-center text-sm">
                  <p className="font-medium">
                    🟢 Vòng bảng đã sinh ({groupMatches.length} trận)
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Nhập điểm cho vòng bảng ở tab <strong>Lịch</strong> hoặc{" "}
                    <strong>Bảng điểm</strong>. Sau khi xong, bấm{" "}
                    <strong>Tạo knockout</strong> ở trên để sinh sơ đồ loại trực
                    tiếp.
                  </p>
                </div>
              );
            }
            return (
              <BracketView
                matches={mainMatches}
                teams={teamsTyped}
                variant="single"
                onMatchClick={onMatchClick}
              />
            );
          }
          return (
            <BracketView
              matches={matchesTyped}
              teams={teamsTyped}
              variant={tournament.format === "double_elim" ? "double" : "single"}
              onMatchClick={onMatchClick}
            />
          );
        })()}

      {activeTab === "schedule" && (
        <ScheduleView
          teams={teamsTyped}
          matches={filteredMatches}
          onMatchClick={onMatchClick}
        />
      )}

      {activeTab === "standings" && !isElim && (
        <>
          {availableGroups.length > 0 && groupFilter === "ALL" ? (
            <div className="space-y-6">
              {availableGroups.map((g) => {
                const gTeams = teamsTyped.filter(
                  (t) => teamGroupMap.get(t.id) === g,
                );
                const gMatches = matchesTyped.filter(
                  (m) => m.groupLabel === g,
                );
                return (
                  <div key={g}>
                    <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {g}
                      </span>
                      Bảng {g} ({gTeams.length} đội)
                    </h3>
                    <StandingsTable
                      teams={gTeams}
                      matches={gMatches}
                      tiebreakers={tiebreakers}
                      randomSeed={randomSeed}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <StandingsTable
              teams={filteredTeams}
              matches={filteredMatches}
              tiebreakers={tiebreakers}
              randomSeed={randomSeed}
            />
          )}
        </>
      )}
    </div>
  );
}
