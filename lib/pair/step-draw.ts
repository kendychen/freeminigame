import {
  shuffleDeterministic,
  type PairParticipant,
  type PairResult,
} from "./shuffle";

/**
 * Bốc thăm từng nhóm một ("quay 1 cặp" / "phát ra tất").
 *
 * Khác với `shuffleParticipants` (tính sẵn toàn bộ rồi công bố một lần), ở đây
 * mỗi lần quay chỉ rút nhóm kế tiếp từ những người CHƯA được chia. Nhờ vậy
 * không có kết quả nào được tính trước và lưu vào DB — `pair_sessions` cho
 * SELECT công khai, nên nếu precompute thì ai cũng đọc trước được kết quả.
 */

export interface StepDrawState {
  /** Các nhóm đã công bố, theo thứ tự. */
  groups: string[][];
  /** Những người không đủ lấp một nhóm đầy (chỉ có khi đã quay hết). */
  byes: string[];
}

/** Id của tất cả những người đã được chia nhóm (hoặc đã thành bye). */
export function assignedIds(state: StepDrawState): Set<string> {
  const out = new Set<string>();
  for (const g of state.groups) for (const id of g) out.add(id);
  for (const id of state.byes) out.add(id);
  return out;
}

/**
 * Những nhóm ghim còn nguyên vẹn (chưa ai trong nhóm bị chia). Nhóm ghim được
 * công bố trước, giống thứ tự của `shuffleParticipants`, và luôn hiển thị công
 * khai là ghim sẵn chứ không giả làm kết quả quay.
 */
function pendingPinGroups(
  participants: PairParticipant[],
  groupSize: number,
  done: Set<string>,
): string[][] {
  const byPin = new Map<string, PairParticipant[]>();
  for (const p of participants) {
    const pin = (p.pin ?? "").trim();
    if (!pin || done.has(p.id)) continue;
    const arr = byPin.get(pin) ?? [];
    arr.push(p);
    byPin.set(pin, arr);
  }
  const entries = Array.from(byPin.entries())
    .map(([pin, members]) => ({
      pin,
      members: [...members].sort(
        (a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id),
      ),
    }))
    .filter((e) => e.members.length >= 2 && groupSize >= 2)
    .sort(
      (a, b) =>
        a.members[0]!.joinedAt - b.members[0]!.joinedAt ||
        a.pin.localeCompare(b.pin),
    );
  return entries.map((e) => e.members.slice(0, groupSize).map((m) => m.id));
}

/** Người còn lại trong "lồng cầu": chưa được chia và không thuộc nhóm ghim còn nguyên. */
export function remainingPool(
  participants: PairParticipant[],
  groupSize: number,
  state: StepDrawState,
): PairParticipant[] {
  const done = assignedIds(state);
  const pinned = new Set(
    pendingPinGroups(participants, groupSize, done).flat(),
  );
  return participants.filter((p) => !done.has(p.id) && !pinned.has(p.id));
}

/**
 * Khi không còn nhóm đầy nào rút được nữa, số người lẻ còn lại thành `byes`
 * ngay trong cùng một bước. Nếu để bước sau mới gom, lượt quay đã `done` và
 * người lẻ bị rơi khỏi kết quả.
 */
function finalize(
  participants: PairParticipant[],
  groupSize: number,
  state: StepDrawState,
): { next: StepDrawState; done: boolean } {
  const pinsLeft = pendingPinGroups(
    participants,
    groupSize,
    assignedIds(state),
  ).length;
  const pool = remainingPool(participants, groupSize, state);
  if (pinsLeft > 0 || pool.length >= groupSize) {
    return { next: state, done: false };
  }
  if (pool.length === 0) return { next: state, done: true };
  return {
    next: { groups: state.groups, byes: [...state.byes, ...pool.map((p) => p.id)] },
    done: true,
  };
}

export interface StepDrawOutcome {
  /** Nhóm vừa quay ra. null khi không còn ai để quay. */
  group: string[] | null;
  /** Nhóm này có sẵn do ghim, không phải quay ra. */
  fromPin: boolean;
  /** Trạng thái sau khi công bố nhóm này. */
  next: StepDrawState;
  /** Đã hết người để quay tiếp. */
  done: boolean;
}

/**
 * Rút nhóm kế tiếp. Nhóm ghim còn nguyên được ưu tiên; nếu nhóm ghim thiếu
 * người thì lấp thêm từ pool, đúng như bốc một lần.
 *
 * Khi số người còn lại ít hơn `groupSize`, họ thành `byes` và lượt quay kết thúc.
 */
export function drawNextGroup(
  participants: PairParticipant[],
  groupSize: number,
  state: StepDrawState,
  seed: number,
): StepDrawOutcome {
  if (groupSize < 2) {
    return { group: null, fromPin: false, next: state, done: true };
  }
  const done = assignedIds(state);
  const pins = pendingPinGroups(participants, groupSize, done);
  const pool = remainingPool(participants, groupSize, state);

  if (pins.length > 0) {
    const group = [...pins[0]!];
    const fill = shuffleDeterministic(pool, seed);
    let i = 0;
    while (group.length < groupSize && i < fill.length) {
      group.push(fill[i]!.id);
      i += 1;
    }
    const fin = finalize(participants, groupSize, {
      groups: [...state.groups, group],
      byes: state.byes,
    });
    return { group, fromPin: true, next: fin.next, done: fin.done };
  }

  if (pool.length < groupSize) {
    // Không đủ lấp một nhóm đầy → số còn lại thành bye, kết thúc.
    const next: StepDrawState = {
      groups: state.groups,
      byes: [...state.byes, ...pool.map((p) => p.id)],
    };
    return { group: null, fromPin: false, next, done: true };
  }

  const picked = shuffleDeterministic(pool, seed)
    .slice(0, groupSize)
    .map((p) => p.id);
  const fin = finalize(participants, groupSize, {
    groups: [...state.groups, picked],
    byes: state.byes,
  });
  return { group: picked, fromPin: false, next: fin.next, done: fin.done };
}

/**
 * Quay hết phần còn lại trong một lần ("phát ra tất"). Mỗi bước dùng seed lệch
 * đi để các nhóm không bị rút theo cùng một thứ tự.
 */
export function drawAllRemaining(
  participants: PairParticipant[],
  groupSize: number,
  state: StepDrawState,
  seed: number,
): { next: StepDrawState; added: string[][] } {
  let cur = state;
  const added: string[][] = [];
  // Chặn trên: mỗi vòng lặp hoặc thêm 1 nhóm hoặc kết thúc.
  for (let step = 0; step < participants.length + 1; step++) {
    const out = drawNextGroup(
      participants,
      groupSize,
      cur,
      (seed + step * 7919) >>> 0,
    );
    cur = out.next;
    if (out.group) added.push(out.group);
    if (out.done) break;
  }
  return { next: cur, added };
}

/** Gói trạng thái từng bước thành `PairResult` để dùng chung với luồng cũ. */
export function toPairResult(
  state: StepDrawState,
  round: number,
): PairResult {
  return {
    round,
    shuffledAt: Date.now(),
    groups: state.groups,
    byes: state.byes,
  };
}
