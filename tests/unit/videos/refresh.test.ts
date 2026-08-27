import { describe, it, expect, vi, beforeEach } from "vitest";
import type { YtVideo } from "@/lib/videos/youtube";
import type { Classification } from "@/lib/videos/classify";

type Op = { table: string; calls: { fn: string; args: unknown[] }[] };

const h = vi.hoisted(() => ({
  ops: [] as Op[],
  state: {
    last_refreshed_at: null as string | null,
    locked_at: null as string | null,
    search_cache: null as Record<string, { ids: string[]; at: string }> | null,
  },
  pinned: [] as { video_id: string }[],
  ranked: [] as { id: string; rank: number }[],
  rankedVi: null as { id: string; rank: number }[] | null,
  details: [] as YtVideo[],
  cls: [] as Classification[],
}));

function resolveFor(op: Op) {
  const has = (fn: string) => op.calls.some((c) => c.fn === fn);
  if (op.table === "technique_refresh_state") {
    if (has("maybeSingle")) return { data: h.state, error: null };
    if (has("update") && has("select")) return { data: [{ slug: "dink" }], error: null };
  }
  if (op.table === "technique_video_overrides" && has("select")) {
    return { data: h.pinned, error: null };
  }
  return { data: [], error: null };
}

function makeBuilder(table: string) {
  const op: Op = { table, calls: [] };
  const proxy: Record<string, unknown> = {};
  const chain = (fn: string) => (...args: unknown[]) => {
    op.calls.push({ fn, args });
    return proxy;
  };
  for (const fn of ["select", "update", "upsert", "delete", "insert", "eq", "is", "lt", "not", "in", "order", "limit", "or"]) {
    proxy[fn] = chain(fn);
  }
  proxy.maybeSingle = (...args: unknown[]) => {
    op.calls.push({ fn: "maybeSingle", args });
    return proxy;
  };
  proxy.then = (
    res: (v: unknown) => unknown,
    rej?: (e: unknown) => unknown,
  ) => {
    h.ops.push(op);
    return Promise.resolve(resolveFor(op)).then(res, rej);
  };
  return proxy;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(async () => ({ value: "k", source: "env" })),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (table: string) => makeBuilder(table) }),
}));
vi.mock("@/lib/videos/youtube", () => ({
  searchVideos: vi.fn(async (_q: string, _f: unknown, _k: unknown, lang: string) =>
    lang === "vi" && h.rankedVi ? h.rankedVi : h.ranked),
  getVideoDetails: vi.fn(async () => h.details),
}));
vi.mock("@/lib/videos/classify", () => ({
  classifyCandidates: vi.fn(async () => h.cls),
}));

import { refreshTechnique } from "@/lib/videos/refresh";
import { searchVideos } from "@/lib/videos/youtube";

const vid = (over: Partial<YtVideo>): YtVideo => ({
  id: "x", title: "t", description: "", channelTitle: "c", publishedAt: "2024-01-01T00:00:00Z",
  durationSec: 300, viewCount: 10, embeddable: true, blockedRegions: [], ...over,
});

const cl = (id: string): Classification => ({
  id, isTutorial: true, score: 90, technique: "dink", level: "basic", summaryVi: "s",
});

const opsOn = (table: string) => h.ops.filter((o) => o.table === table);
const find = (table: string, fn: string) =>
  opsOn(table).filter((o) => o.calls.some((c) => c.fn === fn));
const finalStateUpdate = () => {
  const updates = opsOn("technique_refresh_state").filter(
    (o) => o.calls.some((c) => c.fn === "update") && !o.calls.some((c) => c.fn === "select"),
  );
  return updates.at(-1)?.calls.find((c) => c.fn === "update")?.args[0] as Record<string, unknown> | undefined;
};

beforeEach(() => {
  h.ops.length = 0;
  h.state = { last_refreshed_at: null, locked_at: null, search_cache: null };
  h.pinned = [];
  h.ranked = [];
  h.rankedVi = null;
  h.details = [];
  h.cls = [];
});

describe("refreshTechnique — pinned rows survive the TTL delete", () => {
  it("excludes a pinned id missing from search from the stale delete and bumps its last_seen_at", async () => {
    h.pinned = [{ video_id: "P" }];
    h.ranked = [{ id: "a", rank: 0 }];
    h.details = [vid({ id: "P" }), vid({ id: "a" })];
    h.cls = [cl("a")];

    await refreshTechnique("dink");

    const bump = find("technique_videos", "in")[0];
    expect(bump, "expected an update bumping last_seen_at for pinned ids").toBeDefined();
    expect(bump?.calls.find((c) => c.fn === "update")?.args[0]).toMatchObject({
      last_seen_at: expect.any(String),
    });
    expect(bump?.calls.find((c) => c.fn === "in")?.args).toEqual(["video_id", ["P"]]);

    const del = find("technique_videos", "delete")[0];
    expect(del).toBeDefined();
    const not = del?.calls.find((c) => c.fn === "not");
    expect(not, "stale delete must exclude pinned ids").toBeDefined();
    expect(not?.args[0]).toBe("video_id");
    expect(not?.args[1]).toBe("in");
    expect(String(not?.args[2])).toContain("P");
  });

  it("does not add a not-in filter when nothing is pinned", async () => {
    h.ranked = [{ id: "a", rank: 0 }];
    h.details = [vid({ id: "a" })];
    h.cls = [cl("a")];

    await refreshTechnique("dink");

    const del = find("technique_videos", "delete")[0];
    expect(del?.calls.some((c) => c.fn === "not")).toBe(false);
  });
});

describe("refreshTechnique — empty selection is a failure", () => {
  it("skips upsert/delete, keeps last_refreshed_at, records no_videos_selected and releases the lock", async () => {
    h.ranked = [{ id: "a", rank: 0 }];
    h.details = [vid({ id: "a" })];
    h.cls = [];

    const r = await refreshTechnique("dink");

    expect(find("technique_videos", "upsert")).toHaveLength(0);
    expect(find("technique_videos", "delete")).toHaveLength(0);
    const upd = finalStateUpdate();
    expect(upd).toBeDefined();
    expect(upd).not.toHaveProperty("last_refreshed_at");
    expect(upd?.locked_at).toBeNull();
    expect(upd?.last_error).toBe("no_videos_selected");
    expect(r).toMatchObject({ slug: "dink", error: "no_videos_selected" });
  });

  it("records no_candidates when YouTube returned nothing", async () => {
    h.ranked = [];
    h.details = [];
    h.cls = [];

    const r = await refreshTechnique("dink");

    expect(find("technique_videos", "upsert")).toHaveLength(0);
    expect(find("technique_videos", "delete")).toHaveLength(0);
    expect(finalStateUpdate()?.last_error).toBe("no_candidates");
    expect(r).toMatchObject({ slug: "dink", error: "no_candidates" });
  });
});

describe("refreshTechnique — one market empty", () => {
  it("writes only the non-empty market, still advances last_refreshed_at and notes the empty one", async () => {
    h.ranked = [{ id: "a", rank: 0 }];
    h.rankedVi = [];
    h.details = [vid({ id: "a" })];
    h.cls = [cl("a")];

    const r = await refreshTechnique("dink");

    const upserts = find("technique_videos", "upsert");
    expect(upserts).toHaveLength(1);
    expect((upserts[0]?.calls.find((c) => c.fn === "upsert")?.args[0] as { market: string }[])[0]?.market).toBe("global");
    const deletes = find("technique_videos", "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.calls.find((c) => c.fn === "eq" && c.args[0] === "market")?.args[1]).toBe("global");
    const upd = finalStateUpdate();
    expect(upd?.last_refreshed_at).toEqual(expect.any(String));
    expect(upd?.last_error).toBe("no_videos_selected:vn");
    expect(r).toMatchObject({ slug: "dink", kept: 1 });
  });
});

describe("refreshTechnique — happy path", () => {
  it("upserts, advances last_refreshed_at and clears last_error", async () => {
    h.ranked = [{ id: "a", rank: 0 }];
    h.details = [vid({ id: "a" })];
    h.cls = [cl("a")];

    const r = await refreshTechnique("dink");

    // One upsert + one scoped delete per market (vn, global).
    const upserts = find("technique_videos", "upsert");
    expect(upserts).toHaveLength(2);
    const markets = upserts.map((u) => (u.calls.find((c) => c.fn === "upsert")?.args[0] as { market: string }[])[0]?.market);
    expect(markets.sort()).toEqual(["global", "vn"]);
    expect(upserts[0]?.calls.find((c) => c.fn === "upsert")?.args[1]).toEqual({ onConflict: "technique,market,video_id" });
    const deletes = find("technique_videos", "delete");
    expect(deletes).toHaveLength(2);
    expect(deletes.map((d) => d.calls.find((c) => c.fn === "eq" && c.args[0] === "market")?.args[1]).sort()).toEqual(["global", "vn"]);
    const upd = finalStateUpdate();
    expect(upd?.last_refreshed_at).toEqual(expect.any(String));
    expect(upd?.last_error).toBeNull();
    expect(upd?.locked_at).toBeNull();
    expect(r).toMatchObject({ slug: "dink", kept: 2 });
  });
});

describe("refreshTechnique — YouTube search cache", () => {
  it("reuses cached ids younger than 7 days and never calls searchVideos", async () => {
    vi.mocked(searchVideos).mockClear();
    const at = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    h.state.search_cache = { vn: { ids: ["a"], at }, global: { ids: ["a"], at } };
    h.details = [vid({ id: "a" })];
    h.cls = [cl("a")];

    await refreshTechnique("dink");

    expect(searchVideos).not.toHaveBeenCalled();
    const upd = finalStateUpdate();
    expect(upd?.last_refreshed_at).toEqual(expect.any(String));
    expect(upd?.search_cache).toEqual(h.state.search_cache);
  });

  it("re-searches when the cache is older than 7 days and stores fresh ids", async () => {
    vi.mocked(searchVideos).mockClear();
    const at = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    h.state.search_cache = { vn: { ids: ["old"], at }, global: { ids: ["old"], at } };
    h.ranked = [{ id: "a", rank: 0 }];
    h.details = [vid({ id: "a" })];
    h.cls = [cl("a")];

    await refreshTechnique("dink");

    expect(searchVideos).toHaveBeenCalledTimes(2);
    const cache = finalStateUpdate()?.search_cache as Record<string, { ids: string[] }>;
    expect(cache.vn?.ids).toEqual(["a"]);
    expect(cache.global?.ids).toEqual(["a"]);
  });

  it("keeps freshly searched ids even when classification throws", async () => {
    vi.mocked(searchVideos).mockClear();
    h.ranked = [{ id: "a", rank: 0 }];
    h.details = [vid({ id: "a" })];
    const { classifyCandidates } = await import("@/lib/videos/classify");
    vi.mocked(classifyCandidates).mockRejectedValueOnce(new Error("gemini_http_429"));

    await expect(refreshTechnique("dink")).rejects.toThrow("gemini_http_429");

    const upd = finalStateUpdate();
    expect(upd?.locked_at).toBeNull();
    expect(upd?.last_refreshed_at).toBeUndefined();
    const cache = upd?.search_cache as Record<string, { ids: string[] }>;
    expect(cache.vn?.ids).toEqual(["a"]);
  });
});
