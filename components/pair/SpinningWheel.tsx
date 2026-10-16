"use client";

import { useEffect, useMemo, useState } from "react";
import type { PairParticipant } from "@/lib/pair/shuffle";

export interface SpinningWheelProps {
  participants: PairParticipant[];
  groupSize: number;
  shufflingUntil: string;
  /**
   * Ids đã được chia nhóm ở các lượt trước (chế độ quay từng cặp). Những người
   * này đã ra khỏi "lồng cầu" nên không được cuộn tên nữa.
   */
  assignedIds?: string[];
}

export function SpinningWheel({
  participants,
  groupSize,
  shufflingUntil,
  assignedIds,
}: SpinningWheelProps) {
  const [now, setNow] = useState(0);
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
  // now = 0 ở lần render đầu (trước khi interval chạy) — chưa có mốc thời gian
  // thật thì không hiện số đếm ngược để tránh nhảy ra một con số vô nghĩa.
  const remainingS = now > 0 ? Math.max(0, (endTs - now) / 1000).toFixed(1) : null;

  // Ở chế độ quay từng cặp, người đã có nhóm không spin nữa. Người được ghim
  // sẵn vẫn cuộn tên như mọi người khác — vòng quay không tiết lộ ai bị ghim.
  const spinning = useMemo(() => {
    const done = new Set(assignedIds ?? []);
    return participants.filter((p) => !done.has(p.id));
  }, [participants, assignedIds]);

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

      {/* Thanh chạy liên tục: độ dài lượt quay thay đổi (2.5s / 4s / 7s) nên
          dùng animation thay vì tính % theo mốc bắt đầu. */}
      <div className="mx-auto mb-3 h-3 max-w-md overflow-hidden rounded-full bg-secondary">
        <div className="sweep h-full w-1/3 rounded-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
      </div>

      <p className="text-sm text-muted-foreground">
        {remainingS !== null ? (
          <>
            Còn <strong className="text-primary">{remainingS}s</strong>... 🎉
          </>
        ) : (
          <>Đang quay... 🎉</>
        )}
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
        @keyframes sweep {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(300%);
          }
        }
        .sweep {
          animation: sweep 1.1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
