export const COMMENT_MAX = 500;

export function normalizeComment(
  body: string,
): { ok: true; body: string } | { ok: false; error: "comment_empty" | "comment_too_long" } {
  const b = body.trim();
  if (!b) return { ok: false as const, error: "comment_empty" as const };
  if (b.length > COMMENT_MAX) return { ok: false as const, error: "comment_too_long" as const };
  return { ok: true as const, body: b };
}

export function isRateLimited(recentCreatedAt: string[], nowMs: number): boolean {
  return recentCreatedAt.filter((t) => nowMs - Date.parse(t) < 60_000).length >= 3;
}
