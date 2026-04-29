"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Match,
  Team,
  TournamentFormat,
  SeedingOptions,
} from "@/lib/pairing/types";
import type { TieBreakerConfig } from "@/lib/standings/types";
import { generateSingleElim, advanceWinner } from "@/lib/pairing/single-elim";
import { generateRoundRobin } from "@/lib/pairing/round-robin";
import { generateDoubleElim } from "@/lib/pairing/double-elim";
import {
  generateSwissRound,
  buildSwissHistory,
} from "@/lib/pairing/swiss";
import {
  generateGroupKnockout,
  promoteToKnockout,
} from "@/lib/pairing/group-knockout";
import {
  generateRandomPairs,
  generateRandomGroups,
} from "@/lib/pairing/random-pairs";

export interface QuickTournamentConfig {
  name: string;
  format: TournamentFormat;
  seriesFormat: "bo1" | "bo3" | "bo5";
  doubleRound?: boolean;
  groupSize?: number;
  qualifyPerGroup?: number;
  swissRounds?: number;
  tiebreakers: TieBreakerConfig[];
  seeding: SeedingOptions;
  randomSeed: number;
}

export interface QuickTournamentState {
  id: string;
  createdAt: number;
  updatedAt: number;
  config: QuickTournamentConfig;
  teams: Team[];
  matches: Match[];
  groupAssignments?: Record<string, string[]>; // group label -> team ids
  knockoutGenerated?: boolean;
  swissCurrentRound?: number;
  status: "setup" | "running" | "completed";
  champion?: string | null;
}

interface QuickStoreActions {
  init: (config: QuickTournamentConfig, teams: Team[]) => void;
  reset: () => void;
  setMatches: (matches: Match[]) => void;
  setGroupAssignments: (a: Record<string, string[]>) => void;
  updateScore: (
    matchId: string,
    scoreA: number,
    scoreB: number,
  ) => void;
  setSwissCurrentRound: (n: number) => void;
  setKnockoutGenerated: (b: boolean) => void;
  setChampion: (id: string | null) => void;
  setStatus: (s: "setup" | "running" | "completed") => void;
  loadFromHash: (state: QuickTournamentState) => void;
  exportSnapshot: () => QuickTournamentState | null;
}

interface QuickStore {
  current: QuickTournamentState | null;
  recent: Array<Pick<QuickTournamentState, "id" | "config" | "createdAt" | "status">>;
  actions: QuickStoreActions;
}

const HISTORY_LIMIT = 10;

export const useQuickStore = create<QuickStore>()(
  persist(
    (set, get) => ({
      current: null,
      recent: [],
      actions: {
        init(config, teams) {
          const id = `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
          const seedSource = config.randomSeed || Date.now();
          const ordered = orderTeams(teams, config.seeding, seedSource);
          const created: QuickTournamentState = {
            id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            config: { ...config, randomSeed: seedSource },
            teams: ordered,
            matches: [],
            status: "setup",
          };
          // Generate initial matches synchronously
          const matches = generateForFormat(created);
          created.matches = matches.matches;
          if (matches.groupAssignments) {
            created.groupAssignments = matches.groupAssignments;
          }
          if (config.format === "swiss") created.swissCurrentRound = 1;
          created.status = "running";
          const recent = get().recent;
          set({
            current: created,
            recent: [
              {
                id: created.id,
                config: created.config,
                createdAt: created.createdAt,
                status: created.status,
              },
              ...recent.filter((r) => r.id !== created.id),
            ].slice(0, HISTORY_LIMIT),
          });
        },
        reset() {
          set({ current: null });
        },
        setMatches(matches) {
          set((s) =>
            s.current
              ? { current: { ...s.current, matches, updatedAt: Date.now() } }
              : s,
          );
        },
        setGroupAssignments(a) {
          set((s) =>
            s.current
              ? {
                  current: {
                    ...s.current,
                    groupAssignments: a,
                    updatedAt: Date.now(),
                  },
                }
              : s,
          );
        },
        updateScore(matchId, scoreA, scoreB) {
          const cur = get().current;
          if (!cur) return;
          const updated = cur.matches.map((m) => {
            if (m.id !== matchId) return m;
            const winner =
              scoreA > scoreB ? m.teamA : scoreB > scoreA ? m.teamB : null;
            return {
              ...m,
              scoreA,
              scoreB,
              winner,
              status: winner ? ("completed" as const) : ("live" as const),
            };
          });
          // Auto-advance for Single/Double Elim
          let withAdvance = updated;
          if (
            cur.config.format === "single_elim" ||
            cur.config.format === "double_elim" ||
            cur.config.format === "group_knockout"
          ) {
            withAdvance = advanceWinner(updated, matchId);
          }
          // Determine champion
          const finalMatch = findFinalMatch(withAdvance, cur.config.format);
          const champion = finalMatch?.winner ?? null;
          const status: "setup" | "running" | "completed" =
            champion && finalMatch?.status === "completed"
              ? "completed"
              : "running";
          set({
            current: {
              ...cur,
              matches: withAdvance,
              champion,
              status,
              updatedAt: Date.now(),
            },
          });
        },
        setSwissCurrentRound(n) {
          set((s) =>
            s.current ? { current: { ...s.current, swissCurrentRound: n } } : s,
          );
        },
        setKnockoutGenerated(b) {
          set((s) =>
            s.current
              ? { current: { ...s.current, knockoutGenerated: b } }
              : s,
          );
        },
        setChampion(id) {
          set((s) =>
            s.current ? { current: { ...s.current, champion: id } } : s,
          );
        },
        setStatus(status) {
          set((s) => (s.current ? { current: { ...s.current, status } } : s));
        },
        loadFromHash(state) {
          set({ current: state });
        },
        exportSnapshot() {
          return get().current;
        },
      },
    }),
    {
      name: "freeminigame-quick",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined")
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        return localStorage;
      }),
      partialize: (s) => ({ current: s.current, recent: s.recent }),
    },
  ),
);

function orderTeams(
  teams: Team[],
  seeding: SeedingOptions,
  randomSeed: number,
): Team[] {
  const list = [...teams];
  if (seeding.mode === "random") {
    return shuffleDeterministic(list, randomSeed);
  }
  if (seeding.mode === "ranking") {
    return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }
  return list;
}

function shuffleDeterministic<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

function generateForFormat(t: QuickTournamentState): {
  matches: Match[];
  groupAssignments?: Record<string, string[]>;
} {
  switch (t.config.format) {
    case "random_pairs":
      return {
        matches: generateRandomPairs(t.teams, t.config.randomSeed),
      };
    case "random_groups": {
      const groups = generateRandomGroups(
        t.teams,
        t.config.groupSize ?? 4,
        t.config.randomSeed,
      );
      const assignments: Record<string, string[]> = {};
      for (const g of groups) assignments[g.label] = g.memberIds;
      // No matches generated — display only
      return { matches: [], groupAssignments: assignments };
    }
    case "single_elim":
      return { matches: generateSingleElim(t.teams) };
    case "round_robin":
      return {
        matches: generateRoundRobin(t.teams, {
          doubleRound: t.config.doubleRound,
        }),
      };
    case "double_elim":
      return { matches: generateDoubleElim(t.teams) };
    case "swiss": {
      const history = buildSwissHistory(t.teams, []);
      return {
        matches: generateSwissRound(t.teams, history, 1),
      };
    }
    case "group_knockout": {
      const result = generateGroupKnockout(t.teams, {
        groupSize: t.config.groupSize ?? 4,
        qualifyPerGroup: t.config.qualifyPerGroup ?? 2,
        doubleRound: t.config.doubleRound,
      });
      const all: Match[] = [];
      const assignments: Record<string, string[]> = {};
      for (const [label, ms] of result.groups) {
        all.push(...ms);
        const teamsInGroup = result.groupAssignments.get(label) ?? [];
        assignments[label] = teamsInGroup.map((x) => x.id);
      }
      return { matches: all, groupAssignments: assignments };
    }
  }
}

function findFinalMatch(
  matches: Match[],
  format: TournamentFormat,
): Match | undefined {
  if (format === "single_elim" || format === "group_knockout") {
    const mains = matches.filter((m) => m.bracket === "main");
    const lastRound = Math.max(...mains.map((m) => m.round));
    return mains.find((m) => m.round === lastRound && m.matchNumber === 1);
  }
  if (format === "double_elim") {
    return matches.find((m) => m.bracket === "grand_final");
  }
  return undefined;
}

export { promoteToKnockout, generateSwissRound, buildSwissHistory };
