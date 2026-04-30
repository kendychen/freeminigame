"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { PairResult, PairParticipant } from "@/lib/pair/shuffle";

export interface PairSessionState {
  code: string;
  title: string;
  status: "lobby" | "shuffling" | "shuffled" | "locked" | "closed";
  group_size: number;
  participants: PairParticipant[];
  result: PairResult | null;
  shuffle_count: number;
  created_at: string;
  expires_at: string;
  shuffled_at: string | null;
  shuffling_until: string | null;
  linked_tournament_id: string | null;
  team_id_map: Record<string, string> | null;
  player_id_map: Record<string, string> | null;
  /** participantId -> member display names. Only populated for group-draw lobbies. */
  participantMembers?: Record<string, string[]>;
}

export interface PresenceState {
  hostOnline: boolean;
  viewerCount: number;
  myKey: string;
}

export interface PairLobbyState {
  session: PairSessionState;
  presence: PresenceState;
}

const genKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function usePairLobby(
  code: string,
  initial: PairSessionState,
  role: "host" | "viewer",
): PairLobbyState {
  const [session, setSession] = useState<PairSessionState>(initial);
  const [presence, setPresence] = useState<PresenceState>(() => ({
    hostOnline: false,
    viewerCount: 0,
    myKey: genKey(),
  }));

  useEffect(() => {
    setSession(initial);
  }, [initial]);

  const myKey = useMemo(
    () => presence.myKey,
    [presence.myKey],
  );

  useEffect(() => {
    if (!code) return;
    let active = true;
    let pollHandle: ReturnType<typeof setInterval> | undefined;

    const sb = getSupabaseBrowser();

    const refresh = async () => {
      const res = await fetch(`/api/pair/${code}`, { cache: "no-store" });
      if (res.ok && active) {
        const data = (await res.json()) as PairSessionState;
        setSession(data);
      }
    };

    const channel = sb.channel(`pair:${code}`, {
      config: { presence: { key: myKey } },
    });

    channel.on(
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
    );

    channel.on("presence", { event: "sync" }, () => {
      if (!active) return;
      const state = channel.presenceState() as Record<
        string,
        Array<{ role?: string }>
      >;
      let hostOnline = false;
      let viewerCount = 0;
      for (const arr of Object.values(state)) {
        for (const p of arr) {
          if (p.role === "host") hostOnline = true;
          else viewerCount += 1;
        }
      }
      setPresence((prev) => ({ ...prev, hostOnline, viewerCount }));
    });

    channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ role, ts: Date.now() });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        pollHandle = setInterval(() => void refresh(), 3000);
      }
    });

    return () => {
      active = false;
      if (pollHandle) clearInterval(pollHandle);
      sb.removeChannel(channel);
    };
  }, [code, role, myKey]);

  return { session, presence };
}
