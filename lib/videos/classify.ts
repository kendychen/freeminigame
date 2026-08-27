import { TECHNIQUES, type Technique } from "./techniques";
import type { Market } from "./market";

// gemini-2.5-* were retired for new keys (http_404); Gemini 3 rejects thinkingBudget, uses thinkingLevel.
const MODEL = "gemini-3.5-flash-lite";
const TIMEOUT_MS = 25_000;
// Gemini free tier is rate-limited per minute; back off briefly on 429/503
// instead of failing the whole refresh pass.
const RETRY_DELAYS_MS = [2_000, 6_000];
const MAX_RETRY_AFTER_MS = 10_000;
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function retryDelay(res: Response, attempt: number): number {
  const fallback = RETRY_DELAYS_MS[attempt] ?? 0;
  const header = Number(res.headers?.get?.("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, MAX_RETRY_AFTER_MS);
  return fallback;
}

export type Candidate = {
  id: string; title: string; channelTitle: string; durationSec: number; description: string;
  viewCount?: number; likeCount?: number; commentCount?: number; publishedAt?: string;
};

function ageDays(publishedAt: string | undefined, now: number): number | undefined {
  if (!publishedAt) return undefined;
  const ms = now - new Date(publishedAt).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : undefined;
}
export type Classification = {
  id: string; isTutorial: boolean; score: number; technique: string | null;
  level: "basic" | "advanced"; summaryVi: string;
};

export class ClassifyError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = "ClassifyError";
  }
}

const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      isTutorial: { type: "BOOLEAN" },
      score: { type: "INTEGER" },
      technique: { type: "STRING", nullable: true },
      level: { type: "STRING", enum: ["basic", "advanced"] },
      summaryVi: { type: "STRING" },
    },
    required: ["id", "isTutorial", "score", "technique", "level", "summaryVi"],
  },
};

export function buildPrompt(
  technique: Technique, candidates: Candidate[], market: Market = "global", now: number = Date.now(),
): string {
  const slugs = TECHNIQUES.map((t) => `${t.slug} (${t.nameEn})`).join(", ");
  const list = candidates
    .map((c) => JSON.stringify({
      id: c.id, title: c.title, channel: c.channelTitle,
      durationSec: c.durationSec, description: c.description.slice(0, 500),
      views: c.viewCount, likes: c.likeCount, comments: c.commentCount, ageDays: ageDays(c.publishedAt, now),
    }))
    .join("\n");
  return [
    "Bạn là huấn luyện viên pickleball. Đánh giá các video YouTube dưới đây cho động tác:",
    `"${technique.nameEn}" (tiếng Việt: ${technique.nameVi}).`,
    "",
    "Với MỖI video trả về một object:",
    "- id: giữ nguyên.",
    "- isTutorial: true chỉ khi video DẠY kỹ thuật (hướng dẫn, drill, phân tích động tác). false nếu là highlight, vlog, review vợt, quảng cáo, podcast, trận đấu.",
    ...(market === "vn"
      ? ["  Danh sách này dành cho người xem tiếng Việt: chỉ chấp nhận video nói/viết tiếng Việt (tiêu đề hoặc mô tả chủ yếu bằng tiếng Việt). Video tiếng Anh hoặc ngôn ngữ khác: isTutorial=false, score=0."]
      : []),
    `- technique: slug đúng nhất trong [${slugs}] hoặc null nếu không thuộc động tác nào.`,
    "- score: 0-100, mức hữu ích để người chơi HỌC động tác đã cho (0 nếu không phải tutorial hoặc sai động tác).",
    "  Cân nhắc cả mức độ được cộng đồng đánh giá: views, likes, comments so với ageDays (tuổi video tính bằng ngày).",
    "  Video tương tác cao so với tuổi (nhiều view/like/comment mỗi ngày, tỉ lệ like/view tốt) → cộng điểm.",
    "  Video rất ít tương tác dù đã đăng lâu → trừ điểm. Nhưng không loại tutorial rõ ràng tốt chỉ vì ít view; likes=0 có thể do kênh ẩn số like.",
    "- level: 'basic' nếu video dạy cách thực hiện động tác từ đầu: cầm vợt, tư thế, chuyển động cơ bản, drill lặp lại, nhắm người mới hoặc chưa làm được động tác.",
    "  'advanced' nếu video giả định người xem đã làm được động tác và dạy biến thể, chiến thuật, tình huống thi đấu, tốc độ/spin/đánh lừa, sửa lỗi tinh vi.",
    "- summaryVi: tóm tắt tiếng Việt tối đa 120 ký tự, không dùng dấu ngoặc kép.",
    "",
    "Danh sách video (mỗi dòng một JSON):",
    list,
  ].join("\n");
}

export function parseClassifications(raw: unknown, validIds: Set<string>): Classification[] {
  if (!Array.isArray(raw)) throw new ClassifyError("bad_response", "expected array");
  const out: Classification[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (typeof r?.id !== "string" || !validIds.has(r.id)) continue;
    if (typeof r.isTutorial !== "boolean" || typeof r.score !== "number") continue;
    const technique = typeof r.technique === "string" ? r.technique : null;
    const level = r.level === "advanced" ? "advanced" : "basic";
    const summaryVi = String(r.summaryVi ?? "").replace(/"/g, "").trim().slice(0, 120);
    out.push({
      id: r.id, isTutorial: r.isTutorial,
      score: Math.max(0, Math.min(100, Math.round(r.score))),
      technique, level, summaryVi,
    });
  }
  return out;
}

export async function classifyCandidates(
  technique: Technique, candidates: Candidate[], fetchImpl: typeof fetch = fetch, keyOverride?: string,
  market: Market = "global",
  sleepImpl: (ms: number) => Promise<void> = defaultSleep,
): Promise<Classification[]> {
  if (candidates.length === 0) return [];
  const key = keyOverride || process.env.GEMINI_API_KEY;
  if (!key) throw new ClassifyError("missing_api_key");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const payload = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildPrompt(technique, candidates, market) }] }],
    generationConfig: {
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: "low" },
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });
  try {
    let res: Response;
    for (let attempt = 0; ; attempt++) {
      res = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        { method: "POST", headers: { "content-type": "application/json" }, signal: ctrl.signal, body: payload },
      );
      const retryable = res.status === 429 || res.status === 503;
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) break;
      await sleepImpl(retryDelay(res, attempt));
    }
    if (!res.ok) throw new ClassifyError(`http_${res.status}`);
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new ClassifyError("empty_response");
    let json: unknown;
    try { json = JSON.parse(text); } catch { throw new ClassifyError("bad_json"); }
    return parseClassifications(json, new Set(candidates.map((c) => c.id)));
  } catch (e) {
    if (e instanceof ClassifyError) throw e;
    throw new ClassifyError((e as Error).name === "AbortError" ? "timeout" : "network", (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

/** Free key check: list models. Throws ClassifyError on bad key. */
export async function pingGemini(key: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${key}`);
  if (!res.ok) throw new ClassifyError(`http_${res.status}`);
}
