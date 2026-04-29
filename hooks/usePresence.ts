"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export interface PresentUser {
  id: string;
  displayName: string;
}

export function usePresence(channelName: string, currentUser: PresentUser | null) {
  const [online, setOnline] = useState<PresentUser[]>([]);
  useEffect(() => {
    if (!currentUser) return;
    const sb = getSupabaseBrowser();
    const ch = sb.channel(channelName, {
      config: { presence: { key: currentUser.id } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, PresentUser[]>;
      const list: PresentUser[] = [];
      for (const arr of Object.values(state)) {
        if (arr[0]) list.push(arr[0]);
      }
      setOnline(list);
    });
    ch.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await ch.track(currentUser);
      }
    });
    return () => {
      sb.removeChannel(ch);
    };
  }, [channelName, currentUser]);
  return online;
}
