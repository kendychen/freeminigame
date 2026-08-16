/** Pre-computed balanced PIC (xoay cặp) doubles schedules.
 * Each entry: pair A (indices a[0],a[1]) vs pair B (indices b[0],b[1]).
 */

export interface MatchSlot { a: [number, number]; b: [number, number] }

const SCHEDULES: Record<number, MatchSlot[]> = {
  4: [
    { a: [0, 1], b: [2, 3] },
    { a: [0, 2], b: [1, 3] },
    { a: [0, 3], b: [1, 2] },
  ],
  5: [
    { a: [0, 1], b: [2, 3] },
    { a: [0, 2], b: [3, 4] },
    { a: [0, 3], b: [1, 4] },
    { a: [0, 4], b: [1, 2] },
    { a: [1, 3], b: [2, 4] },
  ],
  6: [
    { a: [0, 1], b: [2, 3] },
    { a: [0, 2], b: [4, 5] },
    { a: [0, 3], b: [1, 5] },
    { a: [1, 4], b: [2, 5] },
    { a: [0, 4], b: [3, 5] },
    { a: [1, 2], b: [3, 4] },
  ],
  7: [
    { a: [0, 1], b: [2, 4] },
    { a: [1, 2], b: [3, 5] },
    { a: [2, 3], b: [4, 6] },
    { a: [3, 4], b: [0, 5] },
    { a: [4, 5], b: [1, 6] },
    { a: [5, 6], b: [0, 2] },
    { a: [0, 6], b: [1, 3] },
  ],
  // 8: balanced — mỗi cặp VĐV chạm mặt tối đa 2 lần (không còn ca "dính" 1 người
  // 3/4 trận như lịch cũ), đủ 28/28 cặp gặp nhau ≥1 lần, không lặp đồng đội,
  // không ai đánh >2 trận liên tiếp hay chờ >2 trận.
  8: [
    { a: [0, 2], b: [4, 5] },
    { a: [0, 3], b: [6, 7] },
    { a: [1, 7], b: [2, 5] },
    { a: [0, 4], b: [1, 3] },
    { a: [4, 7], b: [5, 6] },
    { a: [0, 6], b: [1, 2] },
    { a: [2, 7], b: [3, 4] },
    { a: [1, 6], b: [3, 5] },
  ],
  // 9/10: cyclic a:[i,i+1] b:[i+2,i+4] (mod n) — same construction as 7.
  // Each player plays exactly 4 matches, never repeats a partner or an opponent.
  9: [
    { a: [0, 1], b: [2, 4] },
    { a: [1, 2], b: [3, 5] },
    { a: [2, 3], b: [4, 6] },
    { a: [3, 4], b: [5, 7] },
    { a: [4, 5], b: [6, 8] },
    { a: [5, 6], b: [0, 7] },
    { a: [6, 7], b: [1, 8] },
    { a: [7, 8], b: [0, 2] },
    { a: [0, 8], b: [1, 3] },
  ],
  10: [
    { a: [0, 1], b: [2, 4] },
    { a: [1, 2], b: [3, 5] },
    { a: [2, 3], b: [4, 6] },
    { a: [3, 4], b: [5, 7] },
    { a: [4, 5], b: [6, 8] },
    { a: [5, 6], b: [7, 9] },
    { a: [6, 7], b: [0, 8] },
    { a: [7, 8], b: [1, 9] },
    { a: [8, 9], b: [0, 2] },
    { a: [0, 9], b: [1, 3] },
  ],
  // 11–16: sinh bằng thuật toán cân bằng (mỗi người đúng 4 trận, không lặp đồng
  // đội, mỗi cặp VĐV chạm mặt tối đa 2 lần, thứ tự rải để nghỉ đều) — cho phép
  // "1 bảng chung" với nhóm 11-16 người.
  11: [
    { a: [0, 5], b: [1, 2] },
    { a: [4, 10], b: [7, 8] },
    { a: [1, 3], b: [2, 6] },
    { a: [4, 5], b: [7, 9] },
    { a: [2, 5], b: [8, 10] },
    { a: [0, 3], b: [4, 9] },
    { a: [0, 2], b: [6, 7] },
    { a: [3, 8], b: [5, 7] },
    { a: [1, 6], b: [9, 10] },
    { a: [3, 4], b: [6, 10] },
    { a: [0, 1], b: [8, 9] },
  ],
  12: [
    { a: [3, 6], b: [5, 7] },
    { a: [0, 10], b: [4, 11] },
    { a: [1, 2], b: [8, 9] },
    { a: [0, 3], b: [9, 11] },
    { a: [2, 5], b: [7, 10] },
    { a: [4, 9], b: [6, 8] },
    { a: [1, 10], b: [3, 11] },
    { a: [4, 8], b: [5, 11] },
    { a: [2, 6], b: [3, 7] },
    { a: [0, 4], b: [1, 7] },
    { a: [5, 6], b: [9, 10] },
    { a: [0, 1], b: [2, 8] },
  ],
  13: [
    { a: [5, 8], b: [1, 3] },
    { a: [4, 10], b: [7, 11] },
    { a: [1, 8], b: [2, 5] },
    { a: [3, 11], b: [6, 9] },
    { a: [2, 12], b: [5, 10] },
    { a: [4, 11], b: [3, 6] },
    { a: [8, 12], b: [9, 10] },
    { a: [0, 7], b: [1, 2] },
    { a: [7, 12], b: [9, 11] },
    { a: [0, 1], b: [6, 10] },
    { a: [4, 7], b: [5, 12] },
    { a: [0, 3], b: [2, 8] },
    { a: [4, 9], b: [0, 6] },
  ],
  14: [
    { a: [1, 5], b: [0, 12] },
    { a: [4, 9], b: [6, 13] },
    { a: [7, 10], b: [8, 11] },
    { a: [3, 9], b: [4, 5] },
    { a: [1, 6], b: [0, 8] },
    { a: [4, 10], b: [2, 12] },
    { a: [0, 13], b: [7, 9] },
    { a: [3, 5], b: [1, 2] },
    { a: [11, 13], b: [8, 12] },
    { a: [0, 3], b: [4, 6] },
    { a: [7, 11], b: [2, 13] },
    { a: [5, 12], b: [6, 10] },
    { a: [1, 9], b: [3, 11] },
    { a: [7, 8], b: [2, 10] },
  ],
  15: [
    { a: [3, 11], b: [6, 7] },
    { a: [13, 14], b: [2, 5] },
    { a: [4, 6], b: [0, 1] },
    { a: [2, 13], b: [3, 14] },
    { a: [8, 10], b: [5, 7] },
    { a: [11, 12], b: [1, 9] },
    { a: [6, 10], b: [0, 3] },
    { a: [4, 7], b: [8, 14] },
    { a: [10, 12], b: [9, 13] },
    { a: [0, 8], b: [1, 3] },
    { a: [5, 14], b: [6, 11] },
    { a: [1, 4], b: [8, 12] },
    { a: [5, 9], b: [0, 2] },
    { a: [4, 12], b: [10, 13] },
    { a: [9, 11], b: [2, 7] },
  ],
  16: [
    { a: [5, 15], b: [3, 7] },
    { a: [0, 8], b: [1, 12] },
    { a: [5, 6], b: [3, 9] },
    { a: [4, 15], b: [8, 13] },
    { a: [0, 14], b: [6, 10] },
    { a: [1, 8], b: [3, 4] },
    { a: [5, 12], b: [7, 14] },
    { a: [11, 13], b: [2, 6] },
    { a: [9, 15], b: [4, 10] },
    { a: [0, 2], b: [1, 3] },
    { a: [8, 9], b: [5, 14] },
    { a: [13, 15], b: [6, 11] },
    { a: [0, 10], b: [2, 12] },
    { a: [9, 11], b: [4, 7] },
    { a: [1, 2], b: [12, 13] },
    { a: [11, 14], b: [7, 10] },
  ],
};

// HD variant — alternative schedules (positions referred to as 1A, 2A, 3A...)
// 5-player matches user's reference image schedule.
const SCHEDULES_HD: Record<number, MatchSlot[]> = {
  4: [
    { a: [0, 1], b: [2, 3] },
    { a: [0, 2], b: [1, 3] },
    { a: [0, 3], b: [1, 2] },
  ],
  5: [
    { a: [0, 1], b: [2, 3] }, // A-B vs C-D
    { a: [0, 2], b: [1, 4] }, // A-C vs B-E
    { a: [1, 2], b: [3, 4] }, // B-C vs D-E
    { a: [0, 4], b: [1, 3] }, // A-E vs B-D
    { a: [0, 3], b: [2, 4] }, // A-D vs C-E
  ],
  6: [
    { a: [0, 1], b: [2, 3] }, // A-B vs C-D
    { a: [4, 5], b: [0, 2] }, // E-F vs A-C
    { a: [1, 3], b: [4, 5] }, // B-D vs E-F (rotate)
    { a: [0, 4], b: [2, 5] }, // A-E vs C-F
    { a: [1, 5], b: [3, 4] }, // B-F vs D-E
    { a: [0, 3], b: [1, 2] }, // A-D vs B-C
  ],
  7: SCHEDULES[7]!,
  8: SCHEDULES[8]!,
  9: SCHEDULES[9]!,
  10: SCHEDULES[10]!,
  11: SCHEDULES[11]!,
  12: SCHEDULES[12]!,
  13: SCHEDULES[13]!,
  14: SCHEDULES[14]!,
  15: SCHEDULES[15]!,
  16: SCHEDULES[16]!,
};

export type ScheduleMode = "standard" | "hd";

export function generateGroupSchedule(n: number, mode: ScheduleMode = "standard"): MatchSlot[] {
  const map = mode === "hd" ? SCHEDULES_HD : SCHEDULES;
  const s = map[n];
  if (!s) throw new Error(`Số VĐV phải từ 4 đến 16`);
  return s;
}

/**
 * Lịch "trận cùng loại": đôi nam vs đôi nam · đôi nữ vs đôi nữ · nam-nữ vs nam-nữ.
 * Chạy được với số nam/nữ LỆCH nhau; mỗi VĐV đánh đúng 4 trận; tổng = n trận.
 * Với z trận nam-nữ (chẵn): số trận đôi nam = M − z/2, đôi nữ = F − z/2.
 * Ràng buộc mềm: không lặp đồng đội, mỗi cặp VĐV chạm mặt ≤2 lần (nới lên 3 nếu bí),
 * thứ tự trận được rải để nghỉ đều. Trả null nếu bất khả thi (4 ≤ n ≤ 16).
 */
export function generateGenderTypedSchedule(
  genders: ("M" | "F")[],
  opts?: { forceAllMixed?: boolean },
): MatchSlot[] | null {
  const males: number[] = [];
  const females: number[] = [];
  genders.forEach((g, i) => (g === "M" ? males : females).push(i));
  const M = males.length;
  const F = females.length;
  const n = M + F;
  if (n < 4 || n > 16) return null;

  // forceAllMixed: 100% trận nam-nữ (dùng cho lịch Nam+Nữ / A+B) — cần M = F
  if (opts?.forceAllMixed && M !== F) return null;

  // Các phương án z hợp lệ, ưu tiên cân cả 3 loại trận (z ≈ chẵn(min(M,F)))
  const zOptions: number[] = [];
  for (let z = 2 * Math.min(M, F); z >= 0; z -= 2) {
    const x = M - z / 2;
    const y = F - z / 2;
    if (x < 0 || y < 0) continue;
    if (x > 0 && M < 4) continue; // trận đôi nam cần ≥4 nam
    if (y > 0 && F < 4) continue;
    if (z > 0 && (M < 2 || F < 2)) continue;
    if (opts?.forceAllMixed && z !== 2 * M) continue;
    zOptions.push(z);
  }
  if (!opts?.forceAllMixed) {
    const zPref = 2 * Math.floor(Math.min(M, F) / 2);
    zOptions.sort((a, b) => Math.abs(a - zPref) - Math.abs(b - zPref));
  }

  const key = (a: number, b: number) => (a < b ? a * 100 + b : b * 100 + a);
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };

  const tryBuild = (z: number, cap: number): MatchSlot[] | null => {
    const x = M - z / 2;
    const y = F - z / 2;
    const types = shuffle<"MD" | "WD" | "XD">([
      ...Array<"MD">(x).fill("MD"),
      ...Array<"WD">(y).fill("WD"),
      ...Array<"XD">(z).fill("XD"),
    ]);
    const games = new Array(genders.length).fill(0) as number[];
    const partner = new Set<number>();
    const inter = new Map<number, number>();
    const out: MatchSlot[] = [];

    const pairsOf = (m: MatchSlot): [number, number][] => [
      [m.a[0], m.a[1]], [m.b[0], m.b[1]],
      [m.a[0], m.b[0]], [m.a[0], m.b[1]], [m.a[1], m.b[0]], [m.a[1], m.b[1]],
    ];
    const ok = (m: MatchSlot): boolean => {
      for (const p of [...m.a, ...m.b]) if (games[p]! >= 4) return false;
      if (partner.has(key(m.a[0], m.a[1])) || partner.has(key(m.b[0], m.b[1]))) return false;
      for (const [a, b] of pairsOf(m)) if ((inter.get(key(a, b)) ?? 0) >= cap) return false;
      return true;
    };
    const apply = (m: MatchSlot) => {
      for (const p of [...m.a, ...m.b]) games[p]!++;
      partner.add(key(m.a[0], m.a[1]));
      partner.add(key(m.b[0], m.b[1]));
      for (const [a, b] of pairsOf(m)) inter.set(key(a, b), (inter.get(key(a, b)) ?? 0) + 1);
      out.push(m);
    };

    for (const t of types) {
      const cands: MatchSlot[] = [];
      if (t === "XD") {
        for (let i = 0; i < males.length; i++)
          for (let j = i + 1; j < males.length; j++)
            for (const f1 of females)
              for (const f2 of females) {
                if (f1 === f2) continue;
                const m: MatchSlot = { a: [males[i]!, f1], b: [males[j]!, f2] };
                if (ok(m)) cands.push(m);
              }
      } else {
        const pool = t === "MD" ? males : females;
        for (let a = 0; a < pool.length; a++)
          for (let b = a + 1; b < pool.length; b++)
            for (let c = a; c < pool.length; c++)
              for (let d = c + 1; d < pool.length; d++) {
                const ids = new Set([pool[a], pool[b], pool[c], pool[d]]);
                if (ids.size !== 4 || (c === a && d <= b) || c < a) continue;
                const m: MatchSlot = { a: [pool[a]!, pool[b]!], b: [pool[c]!, pool[d]!] };
                if (ok(m)) cands.push(m);
              }
      }
      if (!cands.length) return null;
      apply(cands[Math.floor(Math.random() * cands.length)]!);
    }
    return out;
  };

  let built: MatchSlot[] | null = null;
  // cap 99: phương án cuối — vd chỉ có 2 nam thì họ buộc phải gặp nhau mọi trận nam-nữ
  outer: for (const cap of [2, 3, 99]) {
    for (const z of zOptions) {
      for (let t = 0; t < 300; t++) {
        built = tryBuild(z, cap);
        if (built) break outer;
      }
    }
  }
  if (!built) return null;

  // Rải thứ tự: hạn chế 1 người đánh liên tiếp
  const order: MatchSlot[] = [];
  const rem = [...built];
  let prev: number[] = [];
  while (rem.length) {
    let bestIdx = 0;
    let bestScore = Infinity;
    for (let i = 0; i < rem.length; i++) {
      const ps = [...rem[i]!.a, ...rem[i]!.b];
      const overlap = ps.filter((p) => prev.includes(p)).length;
      const score = overlap * 10 + Math.random();
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    const next = rem.splice(bestIdx, 1)[0]!;
    order.push(next);
    prev = [...next.a, ...next.b];
  }
  return order;
}

/**
 * Cross-tier schedule: teamA = (A-tier[aIdx], B-tier[bIdx]), same for teamB.
 * Guarantees each A-player partners exactly once with each B-player (Latin square).
 * n = number of players per tier (2 or 4).
 */
export interface CrossMatchSlot {
  teamA: [aIdx: number, bIdx: number];
  teamB: [aIdx: number, bIdx: number];
}

const CROSS_SCHEDULES: Record<number, CrossMatchSlot[]> = {
  2: [
    { teamA: [0, 0], teamB: [1, 1] },
    { teamA: [0, 1], teamB: [1, 0] },
  ],
  4: [
    { teamA: [0, 0], teamB: [1, 1] },
    { teamA: [2, 2], teamB: [3, 3] },
    { teamA: [0, 1], teamB: [2, 3] },
    { teamA: [1, 2], teamB: [3, 0] },
    { teamA: [0, 2], teamB: [3, 1] },
    { teamA: [1, 3], teamB: [2, 0] },
    { teamA: [0, 3], teamB: [1, 0] },
    { teamA: [2, 1], teamB: [3, 2] },
  ],
};

export function generateCrossSchedule(n: number): CrossMatchSlot[] {
  const s = CROSS_SCHEDULES[n];
  if (!s) throw new Error(`Chế độ A/B chỉ hỗ trợ 2 hoặc 4 VĐV mỗi trình mỗi bảng`);
  return s;
}
