"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, ArrowLeft, Trophy } from "lucide-react";
import { RefereeBoard } from "@/components/referee/RefereeBoard";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { DbMatch } from "@/types/database";
import { ThemeToggle } from "@/components/theme/theme-toggle";

interface TeamLite {
  id: string;
  name: string;
  logo_url: string | null;
}

const POLL_MS = 3000;

export function PublicGroupRefereeClient({
  token,
  scope,
  scopeValue,
  tournamentName,
  initialMatches,
  teams: initialTeams,
  membersByTeam,
}: {
  token: string;
  scope: "group" | "bracket" | "match";
  scopeValue: string;
  tournamentName: string;
  initialMatches: DbMatch[];
  teams: TeamLite[];
  membersByTeam?: Record<string, string[]>;
}) {
  const [matches, setMatches] = useState<DbMatch[]>(initialMatches);
  const [teams, setTeams] = useState<TeamLite[]>(initialTeams);
  const [activeId, setActiveId] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/r/${token}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          matches?: DbMatch[];
          teams?: TeamLite[];
        };
        if (cancelled.current) return;
        if (data.matches) setMatches(data.matches);
        if (data.teams) setTeams(data.teams);
      } catch {
        /* swallow */
      }
    };
    const handle = setInterval(tick, POLL_MS);
    return () => {
      cancelled.current = true;
      clearInterval(handle);
    };
  }, [token]);

  const teamById = (id: string | null) =>
    id ? teams.find((t) => t.id === id) : undefined;

  const active = activeId ? matches.find((m) => m.id === activeId) : null;

  if (active) {
    const onIncrement = async (side: "a" | "b", delta: number) => {
      // Direct browser → Supabase RPC (single round-trip ~200ms vs the 600-1200ms
      // we used to spend going through a Vercel server action).
      const sb = getSupabaseBrowser();
      const { data, error } = await sb.rpc("score_increment_by_scoped_token", {
        p_token: token,
        p_match_id: active.id,
        p_side: side,
        p_delta: delta,
      });
      if (error) return { error: error.message };
      const res = data as {
        ok?: boolean;
        error?: string;
        score_a?: number;
        score_b?: number;
        status?: string;
        winner_team_id?: string | null;
      };
      if (res?.error) return { error: res.error };
      setMatches((prev) =>
        prev.map((m) =>
          m.id === active.id
            ? {
                ...m,
                score_a: res.score_a ?? m.score_a,
                score_b: res.score_b ?? m.score_b,
                status: (res.status as DbMatch["status"]) ?? m.status,
                winner_team_id: res.winner_team_id ?? m.winner_team_id,
              }
            : m,
        ),
      );
      return {};
    };
    const onReset = async () => {
      const sb = getSupabaseBrowser();
      const { data, error } = await sb.rpc("score_reset_by_scoped_token", {
        p_token: token,
        p_match_id: active.id,
      });
      if (error) return { error: error.message };
      const res = data as { ok?: boolean; error?: string };
      if (res?.error) return { error: res.error };
      setMatches((prev) =>
        prev.map((m) =>
          m.id === active.id
            ? {
                ...m,
                score_a: 0,
                score_b: 0,
                status: "pending",
                winner_team_id: null,
              }
            : m,
        ),
      );
      return {};
    };
    const onFinalize = async () => {
      const sb = getSupabaseBrowser();
      const { data, error } = await sb.rpc("score_finalize_by_scoped_token", {
        p_token: token,
        p_match_id: active.id,
      });
      if (error) return { error: error.message };
      const res = data as {
        ok?: boolean;
        error?: string;
        winner_team_id?: string | null;
      };
      if (res?.error) return { error: res.error };
      setMatches((prev) =>
        prev.map((m) =>
          m.id === active.id
            ? {
                ...m,
                status: "completed",
                winner_team_id: res.winner_team_id ?? null,
              }
            : m,
        ),
      );
      return {};
    };
    const onReopen = async () => {
      const sb = getSupabaseBrowser();
      const { data, error } = await sb.rpc("score_reopen_by_scoped_token", {
        p_token: token,
        p_match_id: active.id,
      });
      if (error) return { error: error.message };
      const res = data as { ok?: boolean; error?: string };
      if (res?.error) return { error: res.error };
      setMatches((prev) =>
        prev.map((m) =>
          m.id === active.id
            ? {
                ...m,
                status: m.score_a + m.score_b > 0 ? "live" : "pending",
                winner_team_id: null,
              }
            : m,
        ),
      );
      return {};
    };
    return (
      <RefereeBoard
        match={active}
        teams={teams}
        tournamentName={tournamentName}
        subtitle={
          scope === "group"
            ? `Bảng ${scopeValue} · Trọng tài (link chia sẻ)`
            : "Trọng tài (link chia sẻ)"
        }
        exitHref={null}
        onIncrement={onIncrement}
        onReset={onReset}
        onFinalize={onFinalize}
        onReopen={onReopen}
        membersByTeam={membersByTeam}
        headerExtra={
          <button
            onClick={() => setActiveId(null)}
            className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <ArrowLeft className="size-3.5" />
            Danh sách
          </button>
        }
      />
    );
  }

  // List view: pick a match to score
  const byRound = new Map<number, DbMatch[]>();
  for (const m of matches) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }
  const rounds = Array.from(byRound.entries()).sort(([a], [b]) => a - b);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-3 sm:px-4">
          <div className="flex flex-col">
            <span className="truncate text-sm font-bold">{tournamentName}</span>
            <span className="text-[11px] text-muted-foreground">
              {scope === "group"
                ? `Trọng tài bảng ${scopeValue}`
                : scope === "bracket"
                  ? `Trọng tài ${scopeValue === "main" ? "Cúp chính" : scopeValue === "plate" ? "Cúp phụ" : scopeValue}`
                  : "Trọng tài"}
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4 sm:px-4 sm:py-6">
        {matches.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            Chưa có trận đấu nào trong phạm vi này.
          </div>
        ) : (
          <div className="space-y-4">
            {rounds.map(([round, ms]) => (
              <div key={round}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vòng {round}
                </h2>
                <div className="space-y-1.5">
                  {ms.map((m) => {
                    const a = teamById(m.team_a_id);
                    const b = teamById(m.team_b_id);
                    const isCompleted = m.status === "completed";
                    const isLive = m.status === "live";
                    const isBye = m.status === "bye";
                    const canScore = !!m.team_a_id && !!m.team_b_id && !isBye;
                    return (
                      <button
                        key={m.id}
                        onClick={() => canScore && setActiveId(m.id)}
                        disabled={!canScore}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-3 py-3 text-left transition-colors ${
                          canScore
                            ? "hover:border-primary/50 hover:bg-accent/30 active:scale-[0.99]"
                            : "opacity-50"
                        }`}
                      >
                        <div className="flex flex-1 items-center gap-3">
                          {isLive && (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-500">
                              <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
                              LIVE
                            </span>
                          )}
                          {isCompleted && (
                            <Trophy className="size-3.5 shrink-0 text-primary" />
                          )}
                          <div className="flex flex-1 items-center gap-2 truncate text-sm">
                            <span
                              className={`flex-1 truncate ${
                                isCompleted && m.winner_team_id === m.team_a_id
                                  ? "font-semibold text-primary"
                                  : ""
                              }`}
                            >
                              {a?.name ?? (isBye ? "—" : "TBD")}
                            </span>
                            <span className="shrink-0 rounded bg-secondary px-2 py-0.5 font-mono text-xs tabular-nums">
                              {isBye
                                ? "BYE"
                                : `${m.score_a} - ${m.score_b}`}
                            </span>
                            <span
                              className={`flex-1 truncate text-right ${
                                isCompleted && m.winner_team_id === m.team_b_id
                                  ? "font-semibold text-primary"
                                  : ""
                              }`}
                            >
                              {b?.name ?? (isBye ? "BYE" : "TBD")}
                            </span>
                          </div>
                        </div>
                        {canScore && (
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t bg-card/50 px-3 py-2 text-center text-[11px] text-muted-foreground">
        Bấm trận đấu để mở chế độ chấm điểm fullscreen.
      </footer>
    </div>
  );
}
