"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { generateGroupSchedule } from "@/lib/pic-schedule";

export interface PicPlayer {
  id: string;
  name: string;
}

export interface PicMatch {
  id: string;
  round: number;
  stage: "group" | "final";
  a1: string; a2: string;
  b1: string; b2: string;
  scoreA: number;
  scoreB: number;
  status: "pending" | "completed";
}

export interface PicConfig {
  name: string;
  targetGroup: number;
  targetKnockout: number;
  hasThirdPlace: boolean;
}

export type PicStage = "group" | "draw" | "knockout" | "done";

export interface PicStanding {
  rank: number;
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  diff: number;
}

export interface PicState {
  id: string;
  config: PicConfig;
  players: PicPlayer[];
  groupMatches: PicMatch[];
  knockoutMatches: PicMatch[];
  stage: PicStage;
  createdAt: number;
  updatedAt: number;
}

interface PicStore {
  current: PicState | null;
  actions: {
    init(config: PicConfig, players: PicPlayer[]): void;
    scoreGroup(matchId: string, scoreA: number, scoreB: number): void;
    advanceToDraw(): void;
    drawKnockout(pairs: [[string, string], [string, string]]): void;
    scoreKnockout(matchId: string, scoreA: number, scoreB: number): void;
    reset(): void;
  };
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function computeStandings(
  players: PicPlayer[],
  matches: PicMatch[],
): PicStanding[] {
  const done = matches.filter((m) => m.status === "completed");
  const stats = new Map(
    players.map((p) => [p.id, { wins: 0, losses: 0, pf: 0, pa: 0 }]),
  );

  for (const m of done) {
    const aWon = m.scoreA > m.scoreB;
    for (const pid of [m.a1, m.a2] as string[]) {
      const s = stats.get(pid);
      if (!s) continue;
      if (aWon) s.wins++; else s.losses++;
      s.pf += m.scoreA; s.pa += m.scoreB;
    }
    for (const pid of [m.b1, m.b2] as string[]) {
      const s = stats.get(pid);
      if (!s) continue;
      if (!aWon) s.wins++; else s.losses++;
      s.pf += m.scoreB; s.pa += m.scoreA;
    }
  }

  return players
    .map((p) => {
      const s = stats.get(p.id)!;
      return {
        rank: 0, playerId: p.id, name: p.name,
        wins: s.wins, losses: s.losses,
        pf: s.pf, pa: s.pa, diff: s.pf - s.pa,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.diff - a.diff || a.name.localeCompare(b.name))
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export const usePicStore = create<PicStore>()(
  persist(
    (set) => ({
      current: null,
      actions: {
        init(config, players) {
          const slots = generateGroupSchedule(players.length);
          const groupMatches: PicMatch[] = slots.map((slot, i) => ({
            id: uid(),
            round: i + 1,
            stage: "group",
            a1: players[slot.a[0]]!.id,
            a2: players[slot.a[1]]!.id,
            b1: players[slot.b[0]]!.id,
            b2: players[slot.b[1]]!.id,
            scoreA: 0, scoreB: 0,
            status: "pending",
          }));
          set({
            current: {
              id: uid(),
              config,
              players,
              groupMatches,
              knockoutMatches: [],
              stage: "group",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          });
        },

        scoreGroup(matchId, scoreA, scoreB) {
          set((s) => {
            if (!s.current) return s;
            const groupMatches = s.current.groupMatches.map((m) =>
              m.id === matchId ? { ...m, scoreA, scoreB, status: "completed" as const } : m,
            );
            const allDone = groupMatches.every((m) => m.status === "completed");
            return {
              current: {
                ...s.current,
                groupMatches,
                stage: allDone ? "draw" : "group",
                updatedAt: Date.now(),
              },
            };
          });
        },

        advanceToDraw() {
          set((s) => {
            if (!s.current) return s;
            return { current: { ...s.current, stage: "draw", updatedAt: Date.now() } };
          });
        },

        drawKnockout(pairs) {
          const [[a1, a2], [b1, b2]] = pairs;
          const finalMatch: PicMatch = {
            id: uid(), round: 1, stage: "final",
            a1, a2, b1, b2,
            scoreA: 0, scoreB: 0, status: "pending",
          };
          set((s) => {
            if (!s.current) return s;
            return {
              current: {
                ...s.current,
                knockoutMatches: [finalMatch],
                stage: "knockout",
                updatedAt: Date.now(),
              },
            };
          });
        },

        scoreKnockout(matchId, scoreA, scoreB) {
          set((s) => {
            if (!s.current) return s;
            const knockoutMatches = s.current.knockoutMatches.map((m) =>
              m.id === matchId ? { ...m, scoreA, scoreB, status: "completed" as const } : m,
            );
            const allDone = knockoutMatches.every((m) => m.status === "completed");
            return {
              current: {
                ...s.current,
                knockoutMatches,
                stage: allDone ? "done" : "knockout",
                updatedAt: Date.now(),
              },
            };
          });
        },

        reset() {
          set({ current: null });
        },
      },
    }),
    {
      name: "freeminigame-pic",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined")
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        return localStorage;
      }),
      partialize: (s) => ({ current: s.current }),
    },
  ),
);
