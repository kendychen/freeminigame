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
  stage: "group" | "r16" | "quarterfinal" | "semifinal" | "final" | "third";
  a1: string; a2: string;
  b1: string; b2: string;
  scoreA: number;
  scoreB: number;
  status: "pending" | "completed";
}

export interface PicGroup {
  id: string;
  label: string;        // "A", "B", "C", ...
  playerIds: string[];  // refs into PicState.players
  matches: PicMatch[];
}

export interface PicConfig {
  name: string;
  targetGroup: number;
  targetKnockout: number;
  advancePerGroup: number;
  hasThirdPlace: boolean;
  pointsForWin: number;
  pointsForLoss: number;
  tiebreakerOrder?: "diff_first" | "wins_first";
  drawCode?: string | null;
  drawGroupCount?: number;
  drawAdvancePerGroup?: number;
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
  pts: number;
}

export interface PicState {
  id: string;
  config: PicConfig;
  players: PicPlayer[];
  groups: PicGroup[];
  knockoutMatches: PicMatch[];
  stage: PicStage;
  createdAt: number;
  updatedAt: number;
}

interface PicStore {
  current: PicState | null;
  actions: {
    init(config: PicConfig, allPlayers: string[], groupCount: number): void;
    scoreGroup(groupId: string, matchId: string, scoreA: number, scoreB: number): void;
    advanceToDraw(): void;
    drawKnockout(pairs: [string, string][]): void;
    scoreKnockout(matchId: string, scoreA: number, scoreB: number): void;
    reset(): void;
  };
}

function uid() { return Math.random().toString(36).slice(2, 9); }

/** Compute individual standings for a subset of players within a group. */
export function computeStandings(
  players: PicPlayer[],
  matches: PicMatch[],
  pointsForWin = 2,
  pointsForLoss = 0,
  tiebreakerOrder: "diff_first" | "wins_first" = "diff_first",
): PicStanding[] {
  const done = matches.filter((m) => m.status === "completed");
  const stats = new Map(players.map((p) => [p.id, { wins: 0, losses: 0, pf: 0, pa: 0 }]));

  for (const m of done) {
    const aWon = m.scoreA > m.scoreB;
    for (const pid of [m.a1, m.a2] as string[]) {
      const s = stats.get(pid); if (!s) continue;
      if (aWon) s.wins++; else s.losses++;
      s.pf += m.scoreA; s.pa += m.scoreB;
    }
    for (const pid of [m.b1, m.b2] as string[]) {
      const s = stats.get(pid); if (!s) continue;
      if (!aWon) s.wins++; else s.losses++;
      s.pf += m.scoreB; s.pa += m.scoreA;
    }
  }

  return players
    .map((p) => {
      const s = stats.get(p.id)!;
      const pts = s.wins * pointsForWin + s.losses * pointsForLoss;
      return { rank: 0, playerId: p.id, name: p.name, wins: s.wins, losses: s.losses, pf: s.pf, pa: s.pa, diff: s.pf - s.pa, pts };
    })
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (tiebreakerOrder === "wins_first") {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.diff !== a.diff) return b.diff - a.diff;
      } else {
        if (b.diff !== a.diff) return b.diff - a.diff;
        if (b.wins !== a.wins) return b.wins - a.wins;
      }
      return a.name.localeCompare(b.name);
    })
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

/** Distribute N players into G groups as evenly as possible (snake seeding). */
function distributeToGroups(players: PicPlayer[], groupCount: number): PicGroup[] {
  const groups: PicGroup[] = Array.from({ length: groupCount }, (_, i) => ({
    id: uid(),
    label: String.fromCharCode(65 + i), // A, B, C, ...
    playerIds: [],
    matches: [],
  }));

  // Snake distribution: 0→1→2→3→3→2→1→0→0→...
  let dir = 1, gi = 0;
  for (const p of players) {
    groups[gi]!.playerIds.push(p.id);
    const next = gi + dir;
    if (next >= groupCount || next < 0) { dir = -dir; } else { gi += dir; }
  }

  // Generate matches per group
  for (const g of groups) {
    const n = g.playerIds.length;
    if (n < 4 || n > 8) continue;
    const schedule = generateGroupSchedule(n);
    g.matches = schedule.map((slot, i) => ({
      id: uid(), round: i + 1, stage: "group",
      a1: g.playerIds[slot.a[0]]!, a2: g.playerIds[slot.a[1]]!,
      b1: g.playerIds[slot.b[0]]!, b2: g.playerIds[slot.b[1]]!,
      scoreA: 0, scoreB: 0, status: "pending",
    }));
  }

  return groups;
}

export const usePicStore = create<PicStore>()(
  persist(
    (set, get) => ({
      current: null,
      actions: {
        init(config, allPlayerNames, groupCount) {
          const players: PicPlayer[] = allPlayerNames.map((name, i) => ({
            id: uid(),
            name: name.trim() || `VĐV ${i + 1}`,
          }));
          const groups = distributeToGroups(players, groupCount);
          set({
            current: {
              id: uid(), config, players, groups,
              knockoutMatches: [],
              stage: "group",
              createdAt: Date.now(), updatedAt: Date.now(),
            },
          });
        },

        scoreGroup(groupId, matchId, scoreA, scoreB) {
          set((s) => {
            if (!s.current) return s;
            const groups = s.current.groups.map((g) => {
              if (g.id !== groupId) return g;
              return {
                ...g,
                matches: g.matches.map((m) =>
                  m.id === matchId ? { ...m, scoreA, scoreB, status: "completed" as const } : m,
                ),
              };
            });
            const allDone = groups.every((g) => g.matches.every((m) => m.status === "completed"));
            return {
              current: { ...s.current, groups, stage: allDone ? "draw" : "group", updatedAt: Date.now() },
            };
          });
        },

        advanceToDraw() {
          set((s) => s.current
            ? { current: { ...s.current, stage: "draw", updatedAt: Date.now() } }
            : s
          );
        },

        drawKnockout(pairs) {
          const st = get().current;
          if (!st) return;
          const { hasThirdPlace } = st.config;
          const matches: PicMatch[] = [];

          if (pairs.length === 2) {
            // Direct final (4 advancing)
            matches.push({ id: uid(), round: 1, stage: "final", a1: pairs[0]![0], a2: pairs[0]![1], b1: pairs[1]![0], b2: pairs[1]![1], scoreA: 0, scoreB: 0, status: "pending" });
          } else if (pairs.length <= 4) {
            // Semis (pairs 0v1, 2v3) + final + optional 3rd
            for (let i = 0; i < pairs.length - 1; i += 2) {
              matches.push({ id: uid(), round: i / 2 + 1, stage: "semifinal", a1: pairs[i]![0], a2: pairs[i]![1], b1: pairs[i + 1]![0], b2: pairs[i + 1]![1], scoreA: 0, scoreB: 0, status: "pending" });
            }
            matches.push({ id: uid(), round: 99, stage: "final", a1: "", a2: "", b1: "", b2: "", scoreA: 0, scoreB: 0, status: "pending" });
            if (hasThirdPlace) {
              matches.push({ id: uid(), round: 98, stage: "third", a1: "", a2: "", b1: "", b2: "", scoreA: 0, scoreB: 0, status: "pending" });
            }
          } else if (pairs.length <= 8) {
            // Quarters (pairs 0v1, 2v3, 4v5, 6v7) + semis + final + optional 3rd
            for (let i = 0; i < pairs.length - 1; i += 2) {
              matches.push({ id: uid(), round: i / 2 + 1, stage: "quarterfinal", a1: pairs[i]![0], a2: pairs[i]![1], b1: pairs[i + 1]![0], b2: pairs[i + 1]![1], scoreA: 0, scoreB: 0, status: "pending" });
            }
            matches.push({ id: uid(), round: 1, stage: "semifinal", a1: "", a2: "", b1: "", b2: "", scoreA: 0, scoreB: 0, status: "pending" });
            matches.push({ id: uid(), round: 2, stage: "semifinal", a1: "", a2: "", b1: "", b2: "", scoreA: 0, scoreB: 0, status: "pending" });
            matches.push({ id: uid(), round: 99, stage: "final", a1: "", a2: "", b1: "", b2: "", scoreA: 0, scoreB: 0, status: "pending" });
            if (hasThirdPlace) {
              matches.push({ id: uid(), round: 98, stage: "third", a1: "", a2: "", b1: "", b2: "", scoreA: 0, scoreB: 0, status: "pending" });
            }
          } else {
            // R16 (pairs 0v1 … 14v15) + 4 QF + 2 semi + final + optional 3rd
            for (let i = 0; i < pairs.length - 1; i += 2) {
              matches.push({ id: uid(), round: i / 2 + 1, stage: "r16", a1: pairs[i]![0], a2: pairs[i]![1], b1: pairs[i + 1]![0], b2: pairs[i + 1]![1], scoreA: 0, scoreB: 0, status: "pending" });
            }
            for (let q = 1; q <= 4; q++) {
              matches.push({ id: uid(), round: q, stage: "quarterfinal", a1: "", a2: "", b1: "", b2: "", scoreA: 0, scoreB: 0, status: "pending" });
            }
            matches.push({ id: uid(), round: 1, stage: "semifinal", a1: "", a2: "", b1: "", b2: "", scoreA: 0, scoreB: 0, status: "pending" });
            matches.push({ id: uid(), round: 2, stage: "semifinal", a1: "", a2: "", b1: "", b2: "", scoreA: 0, scoreB: 0, status: "pending" });
            matches.push({ id: uid(), round: 99, stage: "final", a1: "", a2: "", b1: "", b2: "", scoreA: 0, scoreB: 0, status: "pending" });
            if (hasThirdPlace) {
              matches.push({ id: uid(), round: 98, stage: "third", a1: "", a2: "", b1: "", b2: "", scoreA: 0, scoreB: 0, status: "pending" });
            }
          }

          set((s) => s.current
            ? { current: { ...s.current, knockoutMatches: matches, stage: "knockout", updatedAt: Date.now() } }
            : s
          );
        },

        scoreKnockout(matchId, scoreA, scoreB) {
          set((s) => {
            if (!s.current) return s;
            let ko = s.current.knockoutMatches.map((m) =>
              m.id === matchId ? { ...m, scoreA, scoreB, status: "completed" as const } : m,
            );

            // Auto-advance R16 winners → QF
            const r16 = ko.filter((m) => m.stage === "r16").sort((a, b) => a.round - b.round);
            if (r16.length >= 8 && r16.every((m) => m.status === "completed")) {
              const qfs = ko.filter((m) => m.stage === "quarterfinal").sort((a, b) => a.round - b.round);
              if (qfs.length >= 4 && !qfs[0]!.a1) {
                const r16W = r16.map((m) => m.scoreA > m.scoreB ? [m.a1, m.a2] : [m.b1, m.b2]);
                ko = ko.map((m) => {
                  const qi = qfs.findIndex((q) => q.id === m.id);
                  if (qi === -1) return m;
                  return { ...m, a1: r16W[qi * 2]![0]!, a2: r16W[qi * 2]![1]!, b1: r16W[qi * 2 + 1]![0]!, b2: r16W[qi * 2 + 1]![1]! };
                });
              }
            }

            // Auto-advance QF winners → semis
            const qfs = ko.filter((m) => m.stage === "quarterfinal").sort((a, b) => a.round - b.round);
            if (qfs.length >= 4 && qfs.every((m) => m.status === "completed")) {
              const semis = ko.filter((m) => m.stage === "semifinal").sort((a, b) => a.round - b.round);
              if (semis.length >= 2 && !semis[0]!.a1) {
                // Semi1: QF1W vs QF2W; Semi2: QF3W vs QF4W
                const qfW = qfs.map((m) => m.scoreA > m.scoreB ? [m.a1, m.a2] : [m.b1, m.b2]);
                ko = ko.map((m) => {
                  if (m.id === semis[0]!.id) return { ...m, a1: qfW[0]![0]!, a2: qfW[0]![1]!, b1: qfW[1]![0]!, b2: qfW[1]![1]! };
                  if (m.id === semis[1]!.id) return { ...m, a1: qfW[2]![0]!, a2: qfW[2]![1]!, b1: qfW[3]![0]!, b2: qfW[3]![1]! };
                  return m;
                });
              }
            }

            // Auto-advance semi winners → final/3rd
            const semis = ko.filter((m) => m.stage === "semifinal");
            if (semis.length >= 2 && semis.every((m) => m.status === "completed")) {
              const finalM = ko.find((m) => m.stage === "final");
              if (finalM && !finalM.a1) {
                const winners = semis.map((m) =>
                  m.scoreA > m.scoreB ? [m.a1, m.a2] as [string, string] : [m.b1, m.b2] as [string, string]
                );
                const losers = semis.map((m) =>
                  m.scoreA > m.scoreB ? [m.b1, m.b2] as [string, string] : [m.a1, m.a2] as [string, string]
                );
                ko = ko.map((m) => {
                  if (m.stage === "final") return { ...m, a1: winners[0]![0], a2: winners[0]![1], b1: winners[1]![0], b2: winners[1]![1] };
                  if (m.stage === "third") return { ...m, a1: losers[0]![0], a2: losers[0]![1], b1: losers[1]![0], b2: losers[1]![1] };
                  return m;
                });
              }
            }

            const relevant = ko.filter((m) => m.stage !== "third" || s.current!.config.hasThirdPlace);
            const allDone = relevant.every((m) => m.status === "completed");
            return {
              current: { ...s.current, knockoutMatches: ko, stage: allDone ? "done" : "knockout", updatedAt: Date.now() },
            };
          });
        },

        reset() { set({ current: null }); },
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
