"use client";

import { useEffect, useRef, useState } from "react";
import { RefereeBoard } from "@/components/referee/RefereeBoard";
import {
  publicIncrementByToken,
  publicResetByToken,
  publicFinalizeByToken,
  publicReopenByToken,
} from "@/app/actions/matches";
import type { DbMatch } from "@/types/database";

interface TeamLite {
  id: string;
  name: string;
  logo_url: string | null;
}

const POLL_MS = 2500;

export function PublicRefereeClient({
  token,
  tournamentName,
  initialMatch,
  teams: initialTeams,
}: {
  token: string;
  tournamentName: string;
  initialMatch: DbMatch;
  teams: TeamLite[];
}) {
  const [match, setMatch] = useState<DbMatch>(initialMatch);
  const [teams, setTeams] = useState<TeamLite[]>(initialTeams);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/r/${token}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          match: DbMatch;
          teams: TeamLite[];
        };
        if (cancelled.current) return;
        setMatch(data.match);
        if (data.teams) setTeams(data.teams);
      } catch {
        // network blip — let next tick handle it
      }
    };
    const handle = setInterval(tick, POLL_MS);
    return () => {
      cancelled.current = true;
      clearInterval(handle);
    };
  }, [token]);

  const onIncrement = async (side: "a" | "b", delta: number) => {
    const res = await publicIncrementByToken({ token, side, delta });
    if ("error" in res) return { error: res.error };
    // Apply server-confirmed values immediately so the board doesn't wait for the
    // next poll tick.
    setMatch((m) => ({
      ...m,
      score_a: res.scoreA,
      score_b: res.scoreB,
      status: res.status,
      winner_team_id: res.winner ?? null,
    }));
    return {};
  };

  const onReset = async () => {
    const res = await publicResetByToken({ token });
    if ("error" in res) return { error: res.error };
    setMatch((m) => ({
      ...m,
      score_a: 0,
      score_b: 0,
      status: "pending",
      winner_team_id: null,
    }));
    return {};
  };

  const onFinalize = async () => {
    const res = await publicFinalizeByToken({ token });
    if ("error" in res) return { error: res.error };
    setMatch((m) => ({
      ...m,
      status: "completed",
      winner_team_id: res.winner ?? null,
    }));
    return {};
  };

  const onReopen = async () => {
    const res = await publicReopenByToken({ token });
    if ("error" in res) return { error: res.error };
    setMatch((m) => ({
      ...m,
      status: m.score_a + m.score_b > 0 ? "live" : "pending",
      winner_team_id: null,
    }));
    return {};
  };

  return (
    <RefereeBoard
      match={match}
      teams={teams}
      tournamentName={tournamentName}
      subtitle="Trọng tài (link chia sẻ)"
      exitHref={null}
      onIncrement={onIncrement}
      onReset={onReset}
      onFinalize={onFinalize}
      onReopen={onReopen}
    />
  );
}
