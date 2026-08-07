/** Team mode validation — single source of truth, imported by both server actions
 * and client components for instant feedback. Pure functions, no IO. */

import { CATEGORY_LABELS } from "./types";
import type { DbTeamPlayer, Gender, RubberCategory, TeamConfig } from "./types";

export const MIN_TEAM_SIZE = 2;
export const MAX_TEAM_SIZE = 20;
export const MAX_RUBBERS = 9;
export const MIN_SQUADS = 2;
export const MAX_SQUADS = 32;
export const MAX_PLAYERS_PER_EVENT = 200;

export interface ValidationError {
  code: string;
  message: string;
}

export interface RosterRequirement {
  minM: number;
  minF: number;
  minTotal: number;
}

export interface LineupSlots {
  a1: string | null;
  a2: string | null;
  b1: string | null;
  b2: string | null;
}

export type LineupPlayer = Pick<DbTeamPlayer, "id" | "squad_id" | "gender">;

function countByCategory(rubbers: RubberCategory[]): Record<RubberCategory, number> {
  const c: Record<RubberCategory, number> = { MD: 0, WD: 0, XD: 0, FD: 0 };
  for (const r of rubbers) c[r] += 1;
  return c;
}

// ── Config ─────────────────────────────────────────────────────────────────────

export function validateTeamConfig(config: TeamConfig): ValidationError | null {
  if (
    !Array.isArray(config.rubbers) ||
    config.rubbers.length < 1 ||
    config.rubbers.length > MAX_RUBBERS ||
    config.rubbers.some((r) => !(r in CATEGORY_LABELS))
  ) {
    return {
      code: "invalid_rubbers",
      message: `Nội dung thi đấu phải từ 1 đến ${MAX_RUBBERS}`,
    };
  }
  if (
    !Number.isInteger(config.teamSize) ||
    config.teamSize < MIN_TEAM_SIZE ||
    config.teamSize > MAX_TEAM_SIZE
  ) {
    return {
      code: "invalid_team_size",
      message: `Số VĐV mỗi đội phải từ ${MIN_TEAM_SIZE} đến ${MAX_TEAM_SIZE}`,
    };
  }
  if (
    !Number.isInteger(config.targetPoints) ||
    config.targetPoints < 1 ||
    config.targetPoints > 99
  ) {
    return { code: "invalid_target_points", message: "Điểm mỗi trận không hợp lệ" };
  }
  return null;
}

// ── Roster hard minimums (§7 + §2.3) ───────────────────────────────────────────

/**
 * Minimum roster per squad to field every rubber.
 * allowRepeatPlayer=true (default): players may play multiple rubbers (sequential),
 * so only "can field each category" counts. allowRepeatPlayer=false: every rubber
 * needs distinct players — M ≥ 2·#MD + #XD, F ≥ 2·#WD + #XD, total ≥ 2·#rubbers.
 */
export function rosterRequirement(config: TeamConfig): RosterRequirement {
  const c = countByCategory(config.rubbers);
  if (config.allowRepeatPlayer === false) {
    return {
      minM: 2 * c.MD + c.XD,
      minF: 2 * c.WD + c.XD,
      minTotal: 2 * (c.MD + c.WD + c.XD + c.FD),
    };
  }
  const minM = c.MD > 0 ? 2 : c.XD > 0 ? 1 : 0;
  const minF = c.WD > 0 ? 2 : c.XD > 0 ? 1 : 0;
  return { minM, minF, minTotal: Math.max(minM + minF, c.FD > 0 ? 2 : 0) };
}

export function meetsRosterMinimum(
  players: Pick<DbTeamPlayer, "gender">[],
  config: TeamConfig,
): boolean {
  const req = rosterRequirement(config);
  const m = players.filter((p) => p.gender === "M").length;
  const f = players.filter((p) => p.gender === "F").length;
  return m >= req.minM && f >= req.minF && players.length >= req.minTotal;
}

/** Vietnamese per-squad errors for generateTeamSchedule detail. Empty = OK. */
export function validateSquadRoster(
  squadName: string,
  players: Pick<DbTeamPlayer, "gender">[],
  config: TeamConfig,
): string[] {
  const c = countByCategory(config.rubbers);
  const m = players.filter((p) => p.gender === "M").length;
  const f = players.filter((p) => p.gender === "F").length;
  const errors: string[] = [];

  if (config.allowRepeatPlayer === false) {
    const req = rosterRequirement(config);
    if (m < req.minM) {
      errors.push(
        `Đội ${squadName} thiếu VĐV nam: cần ≥${req.minM} khi không cho đánh lặp nội dung`,
      );
    }
    if (f < req.minF) {
      errors.push(
        `Đội ${squadName} thiếu VĐV nữ: cần ≥${req.minF} khi không cho đánh lặp nội dung`,
      );
    }
    if (players.length < req.minTotal) {
      errors.push(
        `Đội ${squadName} thiếu VĐV: cần ≥${req.minTotal} cho ${config.rubbers.length} nội dung khi không cho đánh lặp`,
      );
    }
    return errors;
  }

  if (c.MD > 0 && m < 2) {
    errors.push(`Đội ${squadName} thiếu VĐV nam: cần ≥2 cho ${CATEGORY_LABELS.MD.toLowerCase()}`);
  } else if (c.XD > 0 && m < 1) {
    errors.push(`Đội ${squadName} thiếu VĐV nam: cần ≥1 cho ${CATEGORY_LABELS.XD.toLowerCase()}`);
  }
  if (c.WD > 0 && f < 2) {
    errors.push(`Đội ${squadName} thiếu VĐV nữ: cần ≥2 cho ${CATEGORY_LABELS.WD.toLowerCase()}`);
  } else if (c.XD > 0 && f < 1) {
    errors.push(`Đội ${squadName} thiếu VĐV nữ: cần ≥1 cho ${CATEGORY_LABELS.XD.toLowerCase()}`);
  }
  if (c.FD > 0 && players.length < 2) {
    errors.push(`Đội ${squadName} thiếu VĐV: cần ≥2 cho ${CATEGORY_LABELS.FD.toLowerCase()}`);
  }
  return errors;
}

/** Soft UI badge: distinct players recommended so nobody plays twice, capped at teamSize. */
export function recommendedDistinctPlayers(config: TeamConfig): number {
  const c = countByCategory(config.rubbers);
  return Math.min(2 * (c.MD + c.WD + c.XD + c.FD), config.teamSize);
}

// ── Lineup (§7 + §2.3) ─────────────────────────────────────────────────────────

const CATEGORY_GENDER_ERRORS: Partial<Record<RubberCategory, string>> = {
  MD: "Đôi nam chỉ gồm VĐV nam",
  WD: "Đôi nữ chỉ gồm VĐV nữ",
  XD: "Đôi nam nữ cần 1 nam + 1 nữ mỗi bên",
};

function sideGenderError(category: RubberCategory, genders: Gender[]): string | null {
  if (category === "MD" && genders.some((g) => g !== "M")) return CATEGORY_GENDER_ERRORS.MD!;
  if (category === "WD" && genders.some((g) => g !== "F")) return CATEGORY_GENDER_ERRORS.WD!;
  if (category === "XD" && genders.length === 2 && genders[0] === genders[1]) {
    return CATEGORY_GENDER_ERRORS.XD!;
  }
  return null;
}

/** Partial lineups are allowed — only filled slots are checked. */
export function validateRubberLineup(
  category: RubberCategory,
  slots: LineupSlots,
  players: LineupPlayer[],
  squadAId: string | null,
  squadBId: string | null,
): ValidationError | null {
  const byId = new Map(players.map((p) => [p.id, p]));
  const picked = [slots.a1, slots.a2, slots.b1, slots.b2].filter((id): id is string => !!id);

  if (new Set(picked).size !== picked.length) {
    return {
      code: "duplicate_player",
      message: "Một VĐV không thể đứng 2 vị trí trong cùng nội dung",
    };
  }

  for (const [id, squadId] of [
    [slots.a1, squadAId],
    [slots.a2, squadAId],
    [slots.b1, squadBId],
    [slots.b2, squadBId],
  ] as const) {
    if (!id) continue;
    const p = byId.get(id);
    if (!p || !squadId || p.squad_id !== squadId) {
      return { code: "wrong_squad", message: "VĐV không thuộc đúng đội" };
    }
  }

  for (const side of [
    [slots.a1, slots.a2],
    [slots.b1, slots.b2],
  ]) {
    const genders = side
      .filter((id): id is string => !!id)
      .map((id) => byId.get(id)!.gender);
    const err = sideGenderError(category, genders);
    if (err) return { code: "gender_mismatch", message: err };
  }
  return null;
}

/**
 * Batch validation for setTieLineup. Pass the FULL merged lineup of every rubber
 * in the tie (existing + edited) so the allowRepeatPlayer=false check sees all.
 */
export function validateTieLineup(
  entries: { rubberId: string; category: RubberCategory; slots: LineupSlots }[],
  players: LineupPlayer[],
  squadAId: string | null,
  squadBId: string | null,
  allowRepeatPlayer: boolean,
): ValidationError | null {
  for (const entry of entries) {
    const err = validateRubberLineup(entry.category, entry.slots, players, squadAId, squadBId);
    if (err) return err;
  }
  if (!allowRepeatPlayer) {
    const seen = new Set<string>();
    for (const entry of entries) {
      const ids = [entry.slots.a1, entry.slots.a2, entry.slots.b1, entry.slots.b2];
      for (const id of ids) {
        if (!id) continue;
        if (seen.has(id)) {
          return {
            code: "player_repeated",
            message: "Giải này không cho phép 1 VĐV đánh nhiều nội dung trong 1 trận đối đầu",
          };
        }
        seen.add(id);
      }
    }
  }
  return null;
}

// ── Scoring (§7) ───────────────────────────────────────────────────────────────

export function validateRubberScore(scoreA: number, scoreB: number): ValidationError | null {
  if (
    !Number.isInteger(scoreA) || !Number.isInteger(scoreB) ||
    scoreA < 0 || scoreA > 99 || scoreB < 0 || scoreB > 99
  ) {
    return { code: "invalid_score", message: "Điểm phải là số nguyên 0–99" };
  }
  if (scoreA === scoreB) {
    return {
      code: "no_draw_rubber",
      message: "Nội dung đôi phải có bên thắng — điểm không được bằng nhau",
    };
  }
  return null;
}
