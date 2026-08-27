"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export type TvConn = "connecting" | "live" | "poll";

export interface TvTable {
  table: string;
  /** postgres_changes filter, e.g. `event_id=eq.<uuid>` */
  filter?: string;
}

const DEBOUNCE_MS = 400;
const POLL_LIVE_MS = 30_000; // safety net even while the socket says SUBSCRIBED
const POLL_DEGRADED_MS = 8_000;
const RELOAD_AFTER_FAILS = 3;
const RELOAD_MIN_AGE_MS = 5 * 60_000;
const RESUB_COOLDOWN_MS = 5_000;

/**
 * Keeps `data` fresh for hours on a TV: realtime postgres_changes trigger a
 * debounced full refetch, a slow poll runs regardless of socket state (covers
 * tables silently missing from the publication / RLS / flaky TV browsers), and
 * the tab re-fetches + re-subscribes every time it becomes visible again.
 * `initial` seeds state once and is never re-applied (no score rollbacks).
 */
export function useTvFeed<T>(opts: {
  key: string;
  initial: T;
  tables: TvTable[];
  refetch: () => Promise<T | null>;
}) {
  const [data, setData] = useState<T>(opts.initial);
  const [conn, setConn] = useState<TvConn>("connecting");
  const [updatedAt, setUpdatedAt] = useState<number>(() => Date.now());
  const [gen, setGen] = useState(0);

  const refetchRef = useRef(opts.refetch);
  const tablesRef = useRef(opts.tables);
  useEffect(() => {
    refetchRef.current = opts.refetch;
    tablesRef.current = opts.tables;
  });

  const inFlight = useRef(false);
  const again = useRef(false);
  const seq = useRef(0);
  const applied = useRef(0);
  const fails = useRef(0);
  const bornAt = useRef(0);
  const lastResub = useRef(0);

  const doRefetch = useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      // Loop instead of recursing so a change that arrived mid-flight is
      // picked up by one more fetch (never more than one queued).
      do {
        again.current = false;
        const mySeq = ++seq.current;
        try {
          const next = await refetchRef.current();
          fails.current = 0;
          // A slow poll response must not overwrite a newer realtime-triggered one.
          if (next && mySeq > applied.current) {
            applied.current = mySeq;
            setData(next);
            setUpdatedAt(Date.now());
          }
        } catch {
          // A deploy invalidates server-action ids while the tab stays open;
          // after repeated failures on a long-lived tab, a reload is the only fix.
          fails.current += 1;
          if (fails.current >= RELOAD_AFTER_FAILS && Date.now() - bornAt.current > RELOAD_MIN_AGE_MS) {
            window.location.reload();
          }
        }
      } while (again.current);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!bornAt.current) bornAt.current = Date.now();
    let active = true;
    let pollMs = POLL_LIVE_MS;
    let pollHandle: ReturnType<typeof setTimeout> | undefined;
    let debounceHandle: ReturnType<typeof setTimeout> | undefined;

    const schedulePoll = () => {
      if (!active) return;
      pollHandle = setTimeout(async () => {
        await doRefetch();
        schedulePoll();
      }, pollMs);
    };
    const setPoll = (ms: number) => {
      if (pollMs === ms) return;
      pollMs = ms;
      if (pollHandle) clearTimeout(pollHandle);
      schedulePoll();
    };

    if (gen > 0) void doRefetch();
    schedulePoll();

    const sb = getSupabaseBrowser();
    const channel = sb.channel(`tv:${opts.key}:${gen}`);
    for (const t of tablesRef.current) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t.table, ...(t.filter ? { filter: t.filter } : {}) },
        () => {
          if (!active) return;
          if (debounceHandle) clearTimeout(debounceHandle);
          debounceHandle = setTimeout(() => void doRefetch(), DEBOUNCE_MS);
        },
      );
    }
    channel.subscribe((status: string) => {
      if (!active) return;
      if (status === "SUBSCRIBED") {
        setConn("live");
        setPoll(POLL_LIVE_MS);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setConn("poll");
        setPoll(POLL_DEGRADED_MS);
      }
    });

    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      // TV browsers fire hidden/visible in bursts (screensaver overlays):
      // resubscribe at most once per cooldown, otherwise just refetch.
      const now = Date.now();
      if (now - lastResub.current < RESUB_COOLDOWN_MS) {
        void doRefetch();
        return;
      }
      lastResub.current = now;
      setGen((g) => g + 1);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVis);
      if (pollHandle) clearTimeout(pollHandle);
      if (debounceHandle) clearTimeout(debounceHandle);
      void sb.removeChannel(channel);
    };
  }, [opts.key, gen, doRefetch]);

  return { data, conn, updatedAt, refresh: doRefetch };
}

const RECENT_MS = 60_000;
const BANNER_MS = 45_000;
const CLOCK_MS = 2_000;

type Seen = { key: string; ids: Set<string>; stamps: Map<string, number> };

/**
 * Tracks ids that flipped to "completed" while the page was open.
 * `recent` = finished within the last 60s (highlight); `banner` = the newest
 * one finished within 45s (announce). Nothing is flagged on first render.
 * Timestamps come from a 2s clock state so render stays pure.
 */
export function useRecentlyCompleted(completedIds: string[]) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(h);
  }, []);

  const key = completedIds.join("|");
  const [seen, setSeen] = useState<Seen | null>(null);
  if (!seen) {
    setSeen({ key, ids: new Set(completedIds), stamps: new Map() });
  } else if (seen.key !== key) {
    const ids = new Set(completedIds);
    const stamps = new Map(seen.stamps);
    for (const id of ids) if (!seen.ids.has(id)) stamps.set(id, now);
    for (const [id, ts] of stamps) if (now - ts > RECENT_MS) stamps.delete(id);
    setSeen({ key, ids, stamps });
  }

  const recent = new Set<string>();
  let banner: string | null = null;
  let bannerTs = 0;
  for (const [id, ts] of seen?.stamps ?? []) {
    if (now - ts <= RECENT_MS) recent.add(id);
    if (now - ts <= BANNER_MS && ts > bannerTs) {
      banner = id;
      bannerTs = ts;
    }
  }
  return { recent, banner };
}
