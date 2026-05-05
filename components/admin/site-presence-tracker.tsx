"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

// Invisible component — mounts on every page in the root layout.
// Joins the shared 'site-presence' Realtime channel so the admin
// health dashboard can count concurrent visitors.
export function SitePresenceTracker() {
  useEffect(() => {
    const sb = getSupabaseBrowser();
    const pid = Math.random().toString(36).slice(2, 10);
    const channel = sb.channel("site-presence", {
      config: { presence: { key: pid } },
    });
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        channel.track({ pid, joined_at: Date.now() });
      }
    });
    return () => {
      void sb.removeChannel(channel);
    };
  }, []);

  return null;
}
