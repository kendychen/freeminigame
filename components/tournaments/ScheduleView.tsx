"use client";

import Link from "next/link";
import { Gavel } from "lucide-react";
import type { Match, Team } from "@/lib/pairing/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  /** Optional team-id → member display names for showing inline under each team. */
  membersByTeam?: Record<string, string[]>;
}

export function ScheduleView({
  teams,
  matches,
  onMatchClick,
  filterGroup,
  showGroupColumn,
  refereeBaseHref,
  membersByTeam,
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
                const isLive = m.status === "live";
                const hasScore = isCompleted || isLive;
                const aMembers = a ? membersByTeam?.[a.id] ?? [] : [];
                const bMembers = b ? membersByTeam?.[b.id] ?? [] : [];
                return (
                  <div key={m.id} className="flex items-stretch gap-1.5">
                  <button
                    type="button"
                    onClick={() => !isBye && onMatchClick?.(m.id)}
                    disabled={isBye}
                    className="flex flex-1 flex-col gap-2 rounded-md border bg-background p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/30 disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-background sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="flex flex-1 items-start gap-3">
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
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span
                          className={`break-words ${
                            isCompleted && m.winner === m.teamA
                              ? "font-semibold text-primary"
                              : "font-medium"
                          }`}
                        >
                          {a?.name ?? (isBye ? "—" : "TBD")}
                        </span>
                        {aMembers.length > 0 && (
                          <span className="text-[11px] leading-tight text-muted-foreground">
                            {aMembers.join(" · ")}
                          </span>
                        )}
                      </div>
                      <span className="self-center text-xs text-muted-foreground">
                        vs
                      </span>
                      <div className="flex flex-1 flex-col gap-0.5 text-right sm:text-left">
                        <span
                          className={`break-words ${
                            isCompleted && m.winner === m.teamB
                              ? "font-semibold text-primary"
                              : "font-medium"
                          }`}
                        >
                          {b?.name ?? (isBye ? "BYE" : "TBD")}
                        </span>
                        {bMembers.length > 0 && (
                          <span className="text-[11px] leading-tight text-muted-foreground">
                            {bMembers.join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`flex shrink-0 items-center justify-center gap-1 self-end rounded px-2 py-0.5 text-xs tabular-nums sm:self-center sm:min-w-[60px] ${
                        isCompleted
                          ? "bg-primary/10 text-primary font-semibold"
                          : isLive
                            ? "bg-red-500/10 text-red-500 font-semibold"
                            : isBye
                              ? "bg-secondary text-muted-foreground"
                              : "bg-secondary"
                      }`}
                    >
                      {isLive && (
                        <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
                      )}
                      {hasScore
                        ? `${m.scoreA}-${m.scoreB}`
                        : isBye
                          ? "Miễn"
                          : "Chưa đấu"}
                    </span>
                  </button>
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
