"use client";

import Link from "next/link";
import { Gavel } from "lucide-react";
import type { Match, Team } from "@/lib/pairing/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

export interface ScheduleViewProps {
  teams: Team[];
  matches: Match[];
  onMatchClick?: (matchId: string) => void;
  filterGroup?: string;
  /** Show "Bảng X" column inline on each match. Auto when matches have mixed group_labels. */
  showGroupColumn?: boolean;
  /** When set, show a "Trọng tài" button per match linking to the fullscreen referee page. */
  refereeBaseHref?: string;
}

export function ScheduleView({
  teams,
  matches,
  onMatchClick,
  filterGroup,
  showGroupColumn,
  refereeBaseHref,
}: ScheduleViewProps) {
  const teamById = useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  const filtered = filterGroup
    ? matches.filter((m) => m.groupLabel === filterGroup)
    : matches;

  // Auto-detect: show group column if multiple distinct group_labels exist
  const groupCount = useMemo(() => {
    const set = new Set<string>();
    for (const m of filtered) if (m.groupLabel) set.add(m.groupLabel);
    return set.size;
  }, [filtered]);
  const showGroupCol = showGroupColumn ?? groupCount > 1;

  const byRound = useMemo(() => {
    const m = new Map<number, Match[]>();
    for (const match of filtered) {
      const arr = m.get(match.round);
      if (arr) arr.push(match);
      else m.set(match.round, [match]);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a - b);
  }, [filtered]);

  return (
    <div className="space-y-4">
      {byRound.map(([round, ms]) => (
        <Card key={round}>
          <CardHeader>
            <CardTitle className="text-base">Vòng {round}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ms.map((m) => {
                const a = m.teamA ? teamById.get(m.teamA) : undefined;
                const b = m.teamB ? teamById.get(m.teamB) : undefined;
                const isBye = m.status === "bye";
                const isCompleted = m.status === "completed";
                return (
                  <div key={m.id} className="flex items-stretch gap-1.5">
                  <Button
                    variant="ghost"
                    onClick={() => !isBye && onMatchClick?.(m.id)}
                    className="flex-1 justify-between font-normal"
                    disabled={isBye}
                  >
                    <span className="flex flex-1 items-center gap-3">
                      {showGroupCol && (
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            m.groupLabel
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                          title={
                            m.groupLabel ? `Bảng ${m.groupLabel}` : "Không bảng"
                          }
                        >
                          {m.groupLabel ?? "—"}
                        </span>
                      )}
                      <span
                        className={`flex-1 text-left ${
                          isCompleted && m.winner === m.teamA
                            ? "font-semibold text-primary"
                            : ""
                        }`}
                      >
                        {a?.name ?? (isBye ? "—" : "TBD")}
                      </span>
                      <span className="text-muted-foreground">vs</span>
                      <span
                        className={`flex-1 text-left ${
                          isCompleted && m.winner === m.teamB
                            ? "font-semibold text-primary"
                            : ""
                        }`}
                      >
                        {b?.name ?? (isBye ? "BYE" : "TBD")}
                      </span>
                    </span>
                    <span
                      className={`min-w-[60px] rounded px-2 py-0.5 text-xs ${
                        isCompleted
                          ? "bg-primary/10 text-primary"
                          : isBye
                            ? "bg-secondary text-muted-foreground"
                            : "bg-secondary"
                      }`}
                    >
                      {isCompleted
                        ? `${m.scoreA}-${m.scoreB}`
                        : isBye
                          ? "Miễn"
                          : "Chưa đấu"}
                    </span>
                  </Button>
                  {refereeBaseHref && !isBye && m.teamA && m.teamB && (
                    <Link
                      href={`${refereeBaseHref}/${m.id}`}
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                      aria-label="Mở chế độ trọng tài"
                      title="Trọng tài"
                    >
                      <Gavel className="size-4" />
                    </Link>
                  )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
