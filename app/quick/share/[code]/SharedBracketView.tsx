"use client";

import { useMemo, useState } from "react";
import type { Match, Team, TournamentFormat } from "@/lib/pairing/types";
import type { TieBreakerConfig } from "@/lib/standings/types";
import { BracketView } from "@/components/bracket/BracketView";
import { ScheduleView } from "@/components/tournaments/ScheduleView";
import { StandingsTable } from "@/components/tournaments/StandingsTable";

interface QuickStateLike {
  config: {
    name: string;
    format: TournamentFormat;
    seriesFormat: string;
    tiebreakers: TieBreakerConfig[];
    qualifyPerGroup?: number;
    randomSeed: number;
  };
  teams: Team[];
  matches: Match[];
  groupAssignments?: Record<string, string[]>;
  champion?: string | null;
}

type Tab = "bracket" | "schedule" | "standings";

export function SharedBracketView({
  payload,
}: {
  payload: { data: unknown; format: string; team_count: number };
}) {
  const state = payload.data as QuickStateLike | null;
  const [activeTab, setActiveTab] = useState<Tab>("bracket");

  const isElim = useMemo(
    () =>
      state?.config.format === "single_elim" ||
      state?.config.format === "double_elim",
    [state],
  );
  const isGroupKO = state?.config.format === "group_knockout";

  if (!state) return <div>Dữ liệu không hợp lệ.</div>;

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: "bracket", label: "Bảng đấu", show: isElim || isGroupKO === true },
    { id: "schedule", label: "Lịch", show: true },
    { id: "standings", label: "Bảng điểm", show: !isElim },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{state.config.name}</h1>
        <p className="text-sm text-muted-foreground">
          {state.teams.length} đội · {state.config.format} ·{" "}
          {state.config.seriesFormat.toUpperCase()}
        </p>
      </div>
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
      {activeTab === "bracket" && (isElim || isGroupKO === true) && (
        <BracketView
          matches={
            isGroupKO
              ? state.matches.filter((m) => m.bracket === "main")
              : state.matches
          }
          teams={state.teams}
          variant={state.config.format === "double_elim" ? "double" : "single"}
        />
      )}
      {activeTab === "schedule" && (
        <ScheduleView teams={state.teams} matches={state.matches} />
      )}
      {activeTab === "standings" && !isElim && (
        <StandingsTable
          teams={state.teams}
          matches={state.matches}
          tiebreakers={state.config.tiebreakers}
          randomSeed={state.config.randomSeed}
        />
      )}
    </div>
  );
}
