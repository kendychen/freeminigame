"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { PairResult, PairParticipant } from "@/lib/pair/shuffle";

export interface PairSessionState {
  code: string;
  title: string;
  status: "lobby" | "shuffled" | "locked";
  group_size: number;
  participants: PairParticipant[];
  result: PairResult | null;
  shuffle_count: number;
  created_at: string;
  expires_at: string;
  shuffled_at: string | null;
}

export function usePairLobby(code: string, initial: PairSessionState | null) {
  const [session, setSession] = useState<PairSessionState | null>(initial);

  useEffect(() => {
    setSession(initial);
  }, [initial]);

  useEffect(() => {
    if (!code) return;
    let active = true;
    let pollHandle: ReturnType<typeof setInterval> | undefined;

    const sb = getSupabaseBrowser();

    // Initial fetch (in case initial=null on client navigate)
    const refresh = async () => {
      const res = await fetch(`/api/pair/${code}`, { cache: "no-store" });
      if (res.ok && active) {
        const data = (await res.json()) as PairSessionState;
        setSession(data);
      }
    };

    const channel = sb
      .channel(`pair:${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pair_sessions",
          filter: `code=eq.${code}`,
        },
        (payload: { new: PairSessionState }) => {
          if (!active) return;
          setSession(payload.new);
        },
      )
      .subscribe((status: string) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Polling fallback
          pollHandle = setInterval(() => void refresh(), 3000);
        }
      });

    return () => {
      active = false;
      if (pollHandle) clearInterval(pollHandle);
      sb.removeChannel(channel);
    };
  }, [code]);

  return session;
}
