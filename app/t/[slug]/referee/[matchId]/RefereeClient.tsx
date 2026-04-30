"use client";

import { useState, useTransition } from "react";
import { Link2, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { RefereeBoard } from "@/components/referee/RefereeBoard";
import {
  incrementScore,
  updateMatchScore,
  getOrCreateRefereeToken,
  revokeRefereeToken,
} from "@/app/actions/matches";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { translateError } from "@/lib/error-messages";
import type { DbMatch } from "@/types/database";

interface TeamLite {
  id: string;
  name: string;
  logo_url: string | null;
}

export function RefereeClient({
  tournamentId,
  tournamentSlug,
  tournamentName,
  initialMatch,
  teams,
}: {
  tournamentId: string;
  tournamentSlug: string;
  tournamentName: string;
  initialMatch: DbMatch;
  teams: TeamLite[];
}) {
  const live = useLiveMatches(tournamentId, [initialMatch]);
  const match = live.find((m) => m.id === initialMatch.id) ?? initialMatch;
  const [, startShare] = useTransition();
  const [token, setToken] = useState<string | null>(
    initialMatch.referee_token,
  );

  const onIncrement = async (side: "a" | "b", delta: number) => {
    const res = await incrementScore({
      matchId: match.id,
      tournamentId,
      side,
      delta,
    });
    return "error" in res ? { error: res.error } : {};
  };

  const onReset = async () => {
    const res = await updateMatchScore({
      matchId: match.id,
      tournamentId,
      scoreA: 0,
      scoreB: 0,
    });
    return "error" in res ? { error: res.error } : {};
  };

  const onShare = () => {
    startShare(async () => {
      const res = await getOrCreateRefereeToken({
        tournamentId,
        matchId: match.id,
      });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      setToken(res.token);
      const url = `${window.location.origin}/r/${res.token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Đã copy link trọng tài",
          description: url,
        });
      } catch {
        prompt("Sao chép link trọng tài:", url);
      }
    });
  };

  const onRevoke = () => {
    if (!confirm("Thu hồi link trọng tài? Người đang dùng link sẽ ko nhập được nữa."))
      return;
    startShare(async () => {
      const res = await revokeRefereeToken({
        tournamentId,
        matchId: match.id,
      });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      setToken(null);
      toast({ title: "Đã thu hồi link" });
    });
  };

  return (
    <RefereeBoard
      match={match}
      teams={teams}
      tournamentName={tournamentName}
      exitHref={`/t/${tournamentSlug}/admin/bracket`}
      onIncrement={onIncrement}
      onReset={onReset}
      headerExtra={
        <>
          <button
            onClick={onShare}
            className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
            title="Sao chép link trọng tài (không cần đăng nhập)"
          >
            <Link2 className="size-3.5" />
            <span className="hidden sm:inline">
              {token ? "Copy link" : "Tạo link"}
            </span>
          </button>
          {token && (
            <button
              onClick={onRevoke}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Thu hồi link"
              aria-label="Thu hồi link"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </>
      }
    />
  );
}
