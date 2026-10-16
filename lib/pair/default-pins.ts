import type { PairParticipant } from "./shuffle";

/**
 * Cặp ghim mặc định dạng chuỗi. Rỗng = tắt, bốc thăm chạy random hoàn toàn.
 *
 * Format: nhóm cách nhau bằng `;`, tên trong nhóm cách nhau bằng `|`.
 *   "An|Bình"          → một cặp ghim
 *   "An|Bình;C|D"      → hai cặp ghim
 *
 * Cặp ghim không hiện nhãn gì trên vòng quay hay thẻ kết quả — người xem thấy
 * y như một cặp quay ra bình thường.
 *
 * Thứ tự ưu tiên: ô cấu hình trong /admin/settings (site_settings
 * `pair_default_pins`, đọc ở `lib/pair/default-pins-store.ts`) → env
 * `PAIR_DEFAULT_PINS` → hằng số này.
 */
export const BUILT_IN_DEFAULT_PINS = "";

/** Env override first, then the built-in constant above. */
export function resolveDefaultPinSpec(
  env: string | undefined = process.env.PAIR_DEFAULT_PINS,
): string[][] {
  const spec = (env ?? "").trim() || BUILT_IN_DEFAULT_PINS;
  return parseDefaultPinSpec(spec);
}

/** Chuỗi spec dùng khi chưa có cấu hình trong DB. */
export function fallbackPinSpec(
  env: string | undefined = process.env.PAIR_DEFAULT_PINS,
): string {
  return (env ?? "").trim() || BUILT_IN_DEFAULT_PINS;
}

/** Đọc `{"spec": "..."}` từ site_settings. Trả về null nếu chưa cấu hình. */
export function parsePinSetting(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const spec = (value as { spec?: unknown }).spec;
    if (typeof spec === "string") return spec;
  }
  return null;
}

/**
 * Tách spec thành các nhóm tên. Nhóm cách nhau bằng `;` hoặc xuống dòng (ô
 * cấu hình trong admin là textarea, nên dán mỗi cặp một dòng phải chạy).
 * Nhóm dưới 2 tên bị bỏ — ghim một người là vô nghĩa.
 */
export function parseDefaultPinSpec(spec: string | undefined): string[][] {
  if (!spec) return [];
  return spec
    .split(/[;\r\n]+/)
    .map((group) =>
      group
        .split("|")
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    )
    .filter((group) => group.length >= 2);
}

/** Lowercase, strip Vietnamese diacritics, collapse whitespace. */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Attach a shared `pin` to participants whose names match a configured default
 * group. Participants that already carry a pin (host pinned them by hand) are
 * left untouched, and a group only applies when every one of its names resolves
 * to a distinct unpinned participant — a partial match is ignored rather than
 * silently locking one person.
 *
 * Returns the same array instance when nothing changed, so callers can skip the
 * extra write.
 */
export function applyDefaultPins(
  participants: PairParticipant[],
  groups: string[][],
  groupSize?: number,
): PairParticipant[] {
  if (groups.length === 0) return participants;

  const byName = new Map<string, PairParticipant[]>();
  for (const p of participants) {
    if ((p.pin ?? "").trim()) continue;
    const key = normalizeName(p.name);
    const arr = byName.get(key) ?? [];
    arr.push(p);
    byName.set(key, arr);
  }

  const assigned = new Map<string, string>();
  groups.forEach((names, gi) => {
    // A group bigger than groupSize would be truncated by extractPinnedGroups,
    // leaving part of the group in the random pool. Skip it instead, matching
    // the `pin_invalid_size` rejection in the manual pin route.
    if (groupSize != null && names.length > groupSize) return;
    const picked: PairParticipant[] = [];
    for (const name of names) {
      const candidate = (byName.get(normalizeName(name)) ?? []).find(
        (p) => !assigned.has(p.id),
      );
      if (!candidate) return; // incomplete group → skip it
      picked.push(candidate);
    }
    const pinId = `default-${gi + 1}`;
    for (const p of picked) assigned.set(p.id, pinId);
  });

  if (assigned.size === 0) return participants;
  return participants.map((p) => {
    const pin = assigned.get(p.id);
    return pin ? { ...p, pin } : p;
  });
}
