"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { usePresenceStore } from "@/stores/presence";

// Invisible component in root layout.
// Joins the shared 'site-presence' channel and writes the live
// member count to the Zustand presence store so any component
// (e.g. CapacityDashboard) can read it without creating a second subscription.
export function SitePresenceTracker() {
  const setOnlineCount = usePresenceStore((s) => s.setOnlineCount);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    const pid = Math.random().toString(36).slice(2, 10);
    const channel = sb.channel("site-presence", {
      config: { presence: { key: pid } },
    });

    const sync = () => {
      const state = channel.presenceState();
      setOnlineCount(Object.keys(state).length);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          channel.track({ pid });
        }
      });

    return () => {
      void sb.removeChannel(channel);
    };
  }, [setOnlineCount]);

  return null;
}
