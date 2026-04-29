"use client";

import { useState, useTransition } from "react";
import { Trophy, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { LiveTournamentView } from "../../LiveTournamentView";
import { MatchScoreDialog } from "@/components/tournaments/MatchScoreDialog";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import {
  generateBracket,
  generateSwissNextRound,
  promoteGroupQualifiers,
} from "@/app/actions/bracket";
import { updateMatchScore } from "@/app/actions/matches";
import type { DbMatch, DbTeam, DbTournament } from "@/types/database";
import type { Match, Team } from "@/lib/pairing/types";
import { translateError } from "@/lib/error-messages";

export function BracketAdminClient({
  tournament,
  teams,
  initialMatches,
}: {
  tournament: DbTournament;
  teams: DbTeam[];
  initialMatches: DbMatch[];
}) {
  const liveMatches = useLiveMatches(tournament.id, initialMatches);
  const [selected, setSelected] = useState<Match | null>(null);
  const [pending, startTransition] = useTransition();

  const teamsTyped: Team[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    seed: t.seed ?? undefined,
    rating: t.rating ?? undefined,
    region: t.region ?? undefined,
    logoUrl: t.logo_url ?? undefined,
  }));

  const [genClicked, setGenClicked] = useState(false);

  const onGenerate = () => {
    setGenClicked(true);
    startTransition(async () => {
      const cfg = (tournament.config ?? {}) as {
        groupSize?: number;
        qualifyPerGroup?: number;
        doubleRound?: boolean;
        seriesFormat?: "bo1" | "bo3" | "bo5";
      };
      const res = await generateBracket({
        tournamentId: tournament.id,
        format: tournament.format,
        seriesFormat: cfg.seriesFormat,
        doubleRound: cfg.doubleRound,
        groupSize: cfg.groupSize,
        qualifyPerGroup: cfg.qualifyPerGroup,
      });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        // Reset only if user can retry (not "already_generated")
        if (res.error !== "already_generated") setGenClicked(false);
      } else {
        toast({
          title: "Đã tạo bảng đấu",
          description: `${res.count} trận`,
        });
      }
    });
  };

  const onSwissNext = () => {
    startTransition(async () => {
      const maxRound = liveMatches.reduce(
        (m, x) => Math.max(m, x.round),
        0,
      );
      const res = await generateSwissNextRound({
        tournamentId: tournament.id,
        roundNumber: maxRound + 1,
      });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
      } else {
        toast({ title: "Đã sinh vòng mới" });
      }
    });
  };

  const onPromote = () => {
    startTransition(async () => {
      const res = await promoteGroupQualifiers({ tournamentId: tournament.id });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
      } else {
        toast({ title: "Đã sinh knockout" });
      }
    });
  };

  const onSaveScore = (id: string, sa: number, sb: number) => {
    startTransition(async () => {
      const res = await updateMatchScore({
        matchId: id,
        tournamentId: tournament.id,
        scoreA: sa,
        scoreB: sb,
      });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
      }
    });
  };

  const onMatchClick = (id: string) => {
    const dbm = liveMatches.find((x) => x.id === id);
    if (!dbm) return;
    setSelected({
      id: dbm.id,
      round: dbm.round,
      matchNumber: dbm.match_number,
      bracket: dbm.bracket,
      groupLabel: dbm.group_label ?? undefined,
      teamA: dbm.team_a_id,
      teamB: dbm.team_b_id,
      scoreA: dbm.score_a,
      scoreB: dbm.score_b,
      winner: dbm.winner_team_id,
      status: dbm.status,
    });
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {liveMatches.length === 0 ? (
          <Button onClick={onGenerate} disabled={pending || genClicked}>
            <Wand2 className={`size-4 ${pending ? "animate-spin" : ""}`} />
            {pending || genClicked ? "Đang tạo bảng đấu…" : "Tạo bảng đấu"}
          </Button>
        ) : (
          <span className="rounded-md border bg-secondary px-3 py-1 text-sm">
            ✅ {liveMatches.length} trận đã tạo
          </span>
        )}
        {tournament.format === "swiss" && liveMatches.length > 0 && (
          <Button variant="outline" onClick={onSwissNext} disabled={pending}>
            Sinh vòng tiếp theo
          </Button>
        )}
        {tournament.format === "group_knockout" && liveMatches.length > 0 && (
          <Button variant="outline" onClick={onPromote} disabled={pending}>
            <Trophy className="size-4" />
            Tạo knockout
          </Button>
        )}
      </div>

      {liveMatches.length > 0 && (
        <LiveTournamentView
          tournament={tournament}
          teams={teams}
          initialMatches={liveMatches}
          onMatchClick={onMatchClick}
          subscribe={false}
        />
      )}

      <MatchScoreDialog
        match={selected}
        teams={teamsTyped}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        onSave={onSaveScore}
      />
    </div>
  );
}
