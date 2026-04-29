"use client";

import { useState, useTransition } from "react";
import { Trophy, Wand2, Dice5 } from "lucide-react";
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

  const onGenerate = () => {
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
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
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
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Đã sinh vòng mới" });
      }
    });
  };

  const onPromote = () => {
    startTransition(async () => {
      const res = await promoteGroupQualifiers({ tournamentId: tournament.id });
      if ("error" in res) {
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
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
        toast({ title: "Lỗi", description: res.error, variant: "destructive" });
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

  const onLaunchLobby = () => {
    if (teams.length < 2) {
      toast({
        title: "Cần ít nhất 2 đội",
        description: "Thêm đội ở tab Đội trước",
        variant: "destructive",
      });
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/pair/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${tournament.name} · Bốc thăm`,
          groupSize: 2,
          presetNames: teams.map((t) => t.name),
          lockOnCreate: true,
        }),
      });
      const json = (await res.json()) as {
        code?: string;
        host_token?: string;
        error?: string;
      };
      if (!res.ok || !json.code || !json.host_token) {
        toast({
          title: "Lỗi",
          description: json.error ?? "",
          variant: "destructive",
        });
        return;
      }
      window.open(`/pair/${json.code}?host=${json.host_token}`, "_blank");
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {liveMatches.length === 0 ? (
          <Button onClick={onGenerate} disabled={pending}>
            <Wand2 className="size-4" />
            {pending ? "Đang tạo…" : "Tạo bảng đấu"}
          </Button>
        ) : (
          <span className="rounded-md border bg-secondary px-3 py-1 text-sm">
            {liveMatches.length} trận
          </span>
        )}
        {tournament.format === "swiss" && liveMatches.length > 0 && (
          <Button variant="outline" onClick={onSwissNext} disabled={pending}>
            Sinh vòng tiếp theo
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onLaunchLobby}
          disabled={pending || teams.length < 2}
          title="Mở phòng bốc thăm realtime với đội của giải này"
        >
          <Dice5 className="size-4" />
          Bốc thăm realtime
        </Button>
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
