"use client";

import type { Match, Team } from "@/lib/pairing/types";
import type { TieBreakerConfig } from "@/lib/standings/types";
import { computeStandings } from "@/lib/standings/compute";
import { useMemo } from "react";

export interface StandingsTableProps {
  teams: Team[];
  matches: Match[];
  tiebreakers?: TieBreakerConfig[];
  groupLabel?: string;
  randomSeed?: number;
  highlight?: number; // top N
}

export function StandingsTable({
  teams,
  matches,
  tiebreakers,
  groupLabel,
  randomSeed,
  highlight,
}: StandingsTableProps) {
  const standings = useMemo(
    () =>
      computeStandings({
        teams,
        matches,
        groupLabel,
        tiebreakers,
        randomSeed,
      }),
    [teams, matches, tiebreakers, groupLabel, randomSeed],
  );
  const teamById = useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs uppercase">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Đội</th>
            <th className="px-2 py-2">Trận</th>
            <th className="px-2 py-2">T</th>
            <th className="px-2 py-2">H</th>
            <th className="px-2 py-2">B</th>
            <th className="px-2 py-2">BT</th>
            <th className="px-2 py-2">BB</th>
            <th className="px-2 py-2">HS</th>
            <th className="px-2 py-2 font-bold">Điểm</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => {
            const team = teamById.get(s.teamId);
            const isQualified = highlight !== undefined && s.rank <= highlight;
            return (
              <tr
                key={s.teamId}
                className={
                  isQualified
                    ? "border-t bg-primary/5 font-medium"
                    : "border-t"
                }
              >
                <td className="px-3 py-2">{s.rank}</td>
                <td className="px-3 py-2">{team?.name ?? "—"}</td>
                <td className="px-2 py-2 text-center">{s.played}</td>
                <td className="px-2 py-2 text-center">{s.wins}</td>
                <td className="px-2 py-2 text-center">{s.draws}</td>
                <td className="px-2 py-2 text-center">{s.losses}</td>
                <td className="px-2 py-2 text-center">{s.goalsFor}</td>
                <td className="px-2 py-2 text-center">{s.goalsAgainst}</td>
                <td className="px-2 py-2 text-center">
                  {s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}
                </td>
                <td className="px-2 py-2 text-center font-bold">{s.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
