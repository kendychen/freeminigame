"use client";

import { useEffect, useMemo, useState } from "react";
import type { PairParticipant } from "@/lib/pair/shuffle";

export interface SpinningWheelProps {
  participants: PairParticipant[];
  groupSize: number;
  shufflingUntil: string;
}

export function SpinningWheel({
  participants,
  groupSize,
  shufflingUntil,
}: SpinningWheelProps) {
  const [now, setNow] = useState(Date.now());
  const [tickIdx, setTickIdx] = useState(0);

  useEffect(() => {
    const t1 = setInterval(() => setNow(Date.now()), 100);
    const t2 = setInterval(() => setTickIdx((i) => i + 1), 80);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  const endTs = new Date(shufflingUntil).getTime();
  const remainingMs = Math.max(0, endTs - now);
  const remainingS = (remainingMs / 1000).toFixed(1);

  // Pinned members are already locked into a group — they never spin.
  const { pinnedGroups, spinning } = useMemo(() => {
    const order: string[] = [];
    const byPin = new Map<string, PairParticipant[]>();
    for (const p of participants) {
      const pin = (p.pin ?? "").trim();
      if (!pin) continue;
      if (!byPin.has(pin)) {
        byPin.set(pin, []);
        order.push(pin);
      }
      byPin.get(pin)!.push(p);
    }
    const groups = order
      .map((pin) => byPin.get(pin)!)
      .filter((members) => members.length >= 2);
    const lockedIds = new Set(groups.flat().map((p) => p.id));
    return {
      pinnedGroups: groups.map((members) => members.map((m) => m.name)),
      spinning: participants.filter((p) => !lockedIds.has(p.id)),
    };
  }, [participants]);

  const allPinned = participants.length > 0 && spinning.length === 0;

  const cycleNames = spinning.length === 0
    ? ["..."]
    : spinning.map((p) => p.name);

  // Cycle 3 names per "slot" representing each spot in a group
  const slotCount = Math.min(groupSize, 3);
  const slots = Array.from({ length: slotCount }, (_, slot) => {
    const name =
      cycleNames[(tickIdx + slot * 3) % cycleNames.length] ?? "...";
    return name;
  });

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-primary/5 p-8 text-center">
      <div className="mb-6 flex items-center justify-center gap-3 text-2xl font-bold">
        <span className="inline-block animate-spin">🎲</span>
        Đang bốc thăm...
        <span
          className="inline-block animate-spin"
          style={{ animationDirection: "reverse" }}
        >
          🎰
        </span>
      </div>

      {allPinned ? (
        <div className="mx-auto mb-6 max-w-2xl rounded-lg border-2 border-primary/40 bg-background p-4 text-lg font-semibold text-primary">
          📌 Tất cả đã ghim
        </div>
      ) : (
      <div className="mx-auto mb-6 flex max-w-2xl flex-wrap items-center justify-center gap-3">
        {slots.map((name, i) => (
          <div
            key={i}
            className="min-w-[120px] rounded-lg border-2 border-primary/40 bg-background p-4 shadow-lg transition-transform"
            style={{
              transform: `rotate(${(tickIdx * 3) % 6 - 3}deg)`,
              animation: `pulse 0.4s ease-in-out infinite alternate`,
            }}
          >
            <div className="text-xs text-muted-foreground">
              {groupSize === 2
                ? i === 0
                  ? "👤 Người 1"
                  : "👤 Người 2"
                : `👤 #${i + 1}`}
            </div>
            <div className="mt-1 truncate font-semibold text-primary">
              {name}
            </div>
          </div>
        ))}
        {groupSize > 3 && (
          <div className="rounded-lg border-2 border-dashed border-primary/40 bg-background/50 p-4">
            <div className="text-sm text-muted-foreground">
              +{groupSize - 3} chỗ
            </div>
          </div>
        )}
      </div>
      )}

      {pinnedGroups.length > 0 && (
        <div className="mx-auto mb-6 max-w-2xl rounded-lg border bg-background/60 p-3 text-left text-sm">
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            📌 Đã ghim sẵn ({pinnedGroups.length})
          </div>
          <ul className="space-y-0.5">
            {pinnedGroups.map((names, i) => (
              <li key={i} className="truncate">
                {names.join(" + ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Progress bar */}
      <div className="mx-auto mb-3 h-3 max-w-md overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary transition-all"
          style={{
            width: `${
              endTs > 0
                ? Math.min(
                    100,
                    Math.max(
                      0,
                      ((Date.now() - (endTs - 7000)) / 7000) * 100,
                    ),
                  )
                : 0
            }%`,
          }}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Còn <strong className="text-primary">{remainingS}s</strong>... 🎉
      </p>

      <style jsx>{`
        @keyframes pulse {
          from {
            transform: scale(1) rotate(-2deg);
          }
          to {
            transform: scale(1.05) rotate(2deg);
          }
        }
      `}</style>
    </div>
  );
}
