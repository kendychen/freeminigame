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
  /** Optional team-id → member display names. Shown under each team name. */
  membersByTeam?: Record<string, string[]>;
}

export function StandingsTable({
  teams,
  matches,
  tiebreakers,
  groupLabel,
  randomSeed,
  highlight,
  membersByTeam,
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
    <div className="space-y-2">
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
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span>{team?.name ?? "—"}</span>
                    {membersByTeam?.[s.teamId] &&
                      membersByTeam[s.teamId]!.length > 0 && (
                        <span className="text-[11px] font-normal text-muted-foreground">
                          {membersByTeam[s.teamId]!.join(" · ")}
                        </span>
                      )}
                  </div>
                </td>
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
    <div className="rounded-md border border-dashed bg-secondary/20 p-2.5 text-[11px] text-muted-foreground sm:text-xs">
      <p className="font-semibold text-foreground">Cách tính & xếp hạng</p>
      <ul className="mt-1 space-y-0.5">
        <li>
          • <strong>Điểm</strong>: Thắng = 3 · Hoà = 1 · Thua = 0
        </li>
        <li>
          • <strong>BT/BB</strong>: bàn thắng / bàn bại tổng cộng
        </li>
        <li>
          • <strong>HS</strong> (hiệu số) = BT − BB
        </li>
        <li>
          • Khi 2+ đội <strong>cùng điểm</strong>, ưu tiên xếp theo:
          <ol className="ml-4 mt-0.5 list-decimal">
            <li>
              <strong>Đối đầu trực tiếp</strong> — đội thắng trận giữa 2 bên
              xếp trên
            </li>
            <li>
              <strong>Hiệu số HS</strong> — HS cao xếp trên (nếu vẫn hoà
              đối đầu hoặc 3+ đội)
            </li>
            <li>
              <strong>Bàn thắng BT</strong> — BT cao xếp trên
            </li>
            <li>Cuối cùng: bốc thăm random</li>
          </ol>
        </li>
      </ul>
    </div>
    </div>
  );
}
