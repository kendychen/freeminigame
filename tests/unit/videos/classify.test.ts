import { describe, it, expect, vi } from "vitest";
import { parseClassifications, classifyCandidates, ClassifyError, buildPrompt } from "@/lib/videos/classify";
import { getTechnique } from "@/lib/videos/techniques";

const valid = new Set(["a", "b"]);

describe("parseClassifications", () => {
  it("keeps valid rows, drops unknown ids and bad shapes, clamps score", () => {
    const rows = [
      { id: "a", isTutorial: true, score: 150, technique: "dink", level: "basic", summaryVi: "ok" },
      { id: "zzz", isTutorial: true, score: 90, technique: "dink", level: "basic", summaryVi: "x" },
      { id: "b", isTutorial: "yes", score: 50, technique: null, level: "advanced", summaryVi: "x" },
    ];
    const out = parseClassifications(rows, valid);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "a", score: 100, level: "basic" });
  });
  it("defaults level to basic when invalid and trims summary to 120 chars", () => {
    const out = parseClassifications(
      [{ id: "a", isTutorial: true, score: 70, technique: "dink", level: "pro", summaryVi: "y".repeat(200) }],
      valid,
    );
    expect(out[0]?.level).toBe("basic");
    expect(out[0]?.summaryVi.length).toBe(120);
  });
  it("returns [] when every score comes back as a string (schema drift)", () => {
    const rows = [
      { id: "a", isTutorial: true, score: "90", technique: "dink", level: "basic", summaryVi: "x" },
      { id: "b", isTutorial: true, score: "70", technique: "dink", level: "advanced", summaryVi: "y" },
    ];
    expect(parseClassifications(rows, valid)).toEqual([]);
  });
  it("throws when not an array", () => {
    expect(() => parseClassifications({}, valid)).toThrow(ClassifyError);
  });
});

describe("buildPrompt — vn market", () => {
  it("adds the Vietnamese-only rule", () => {
    const c = { id: "x", title: "t", channelTitle: "ch", durationSec: 100, description: "d" };
    expect(buildPrompt(getTechnique("dink"), [c], "vn")).toContain("chỉ chấp nhận video nói/viết tiếng Việt");
    expect(buildPrompt(getTechnique("dink"), [c])).not.toContain("chỉ chấp nhận video nói/viết tiếng Việt");
  });
});

describe("buildPrompt", () => {
  it("includes technique names, all slugs and candidate ids", () => {
    const p = buildPrompt(getTechnique("dink"), [
      { id: "a", title: "T", channelTitle: "C", durationSec: 100, description: "d" },
    ]);
    expect(p).toContain("Dink");
    expect(p).toContain("third-shot-drop");
    expect(p).toContain('"a"');
  });
});

describe("classifyCandidates", () => {
  it("parses Gemini JSON text", async () => {
    process.env.GEMINI_API_KEY = "g";
    const text = JSON.stringify([
      { id: "a", isTutorial: true, score: 80, technique: "dink", level: "basic", summaryVi: "Tốt" },
    ]);
    const f = vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    })) as unknown as typeof fetch;
    const out = await classifyCandidates(getTechnique("dink"), [
      { id: "a", title: "T", channelTitle: "C", durationSec: 100, description: "d" },
    ], f);
    expect(out[0]?.score).toBe(80);
  });
  it("returns [] for no candidates without calling API", async () => {
    const f = vi.fn() as unknown as typeof fetch;
    expect(await classifyCandidates(getTechnique("dink"), [], f)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
  it("throws ClassifyError on HTTP error", async () => {
    const f = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(classifyCandidates(getTechnique("dink"), [
      { id: "a", title: "T", channelTitle: "C", durationSec: 100, description: "d" },
    ], f)).rejects.toBeInstanceOf(ClassifyError);
  });
});
