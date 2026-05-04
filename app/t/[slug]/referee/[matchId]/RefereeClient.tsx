"use client";

import { useState, useTransition } from "react";
import { Link2, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { RefereeBoard } from "@/components/referee/RefereeBoard";
import {
  getOrCreateRefereeToken,
  revokeRefereeToken,
} from "@/app/actions/matches";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { getSupabaseBrowser } from "@/lib/supabase/client";
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
  membersByTeam,
}: {
  tournamentId: string;
  tournamentSlug: string;
  tournamentName: string;
  initialMatch: DbMatch;
  teams: TeamLite[];
  membersByTeam?: Record<string, string[]>;
}) {
  const live = useLiveMatches(tournamentId, [initialMatch]);
  const match = live.find((m) => m.id === initialMatch.id) ?? initialMatch;
  const [, startShare] = useTransition();
  const [token, setToken] = useState<string | null>(
    initialMatch.referee_token,
  );

  // Local-first: scores live client-side. Server is only hit on Kết thúc /
  // Mở lại — single RPC round-trip ≈200ms each.
  const onFinalize = async (scoreA: number, scoreB: number) => {
    const sb = getSupabaseBrowser();
    const { data, error } = await sb.rpc("score_finalize_by_owner", {
      p_match_id: match.id,
      p_score_a: scoreA,
      p_score_b: scoreB,
    });
    if (error) return { error: error.message };
    const res = data as { ok?: boolean; error?: string };
    if (res?.error) return { error: res.error };
    return {};
  };

  const onReopen = async () => {
    const sb = getSupabaseBrowser();
    const { data, error } = await sb.rpc("score_reopen_by_owner", {
      p_match_id: match.id,
    });
    if (error) return { error: error.message };
    const res = data as { ok?: boolean; error?: string };
    if (res?.error) return { error: res.error };
    return {};
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
      onFinalize={onFinalize}
      onReopen={onReopen}
      membersByTeam={membersByTeam}
      pickleballMode
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
