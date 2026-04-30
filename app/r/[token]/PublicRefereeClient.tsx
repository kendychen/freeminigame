"use client";

import { useEffect, useRef, useState } from "react";
import { RefereeBoard } from "@/components/referee/RefereeBoard";
import {
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
  membersByTeam,
}: {
  token: string;
  tournamentName: string;
  initialMatch: DbMatch;
  teams: TeamLite[];
  membersByTeam?: Record<string, string[]>;
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

  const onFinalize = async (scoreA: number, scoreB: number) => {
    const res = await publicFinalizeByToken({ token, scoreA, scoreB });
    if ("error" in res) return { error: res.error };
    setMatch((m) => ({
      ...m,
      score_a: scoreA,
      score_b: scoreB,
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
      onFinalize={onFinalize}
      onReopen={onReopen}
      membersByTeam={membersByTeam}
    />
  );
}
