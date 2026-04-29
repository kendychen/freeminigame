"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { DbMatch } from "@/types/database";

export function useLiveMatches(tournamentId: string, initial: DbMatch[]) {
  const [matches, setMatches] = useState<DbMatch[]>(initial);

  useEffect(() => {
    setMatches(initial);
  }, [initial]);

  useEffect(() => {
    let active = true;
    let pollHandle: ReturnType<typeof setInterval> | undefined;
    let etag = "";

    const sb = getSupabaseBrowser();
    const channel = sb
      .channel(`matches:${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        async () => {
          if (!active) return;
          const { data } = await sb
            .from("matches")
            .select("*")
            .eq("tournament_id", tournamentId)
            .order("round")
            .order("match_number");
          if (data && active) setMatches(data as unknown as DbMatch[]);
        },
      )
      .subscribe((status: string) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Fallback: poll endpoint with ETag
          pollHandle = setInterval(async () => {
            const res = await fetch(`/api/matches/${tournamentId}`, {
              headers: etag ? { "If-None-Match": etag } : undefined,
            });
            if (res.status === 304) return;
            const newEtag = res.headers.get("etag") ?? "";
            if (newEtag) etag = newEtag;
            const data = (await res.json()) as DbMatch[];
            if (active) setMatches(data);
          }, 5000);
        }
      });

    return () => {
      active = false;
      if (pollHandle) clearInterval(pollHandle);
      sb.removeChannel(channel);
    };
  }, [tournamentId]);

  return matches;
}
