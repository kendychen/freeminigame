import { describe, expect, it } from "vitest";
import {
  applyDefaultPins,
  fallbackPinSpec,
  parseDefaultPinSpec,
  parsePinSetting,
  resolveDefaultPinSpec,
  BUILT_IN_DEFAULT_PINS,
} from "@/lib/pair/default-pins";
import { shuffleParticipants, type PairParticipant } from "@/lib/pair/shuffle";
import { drawAllRemaining, drawNextGroup } from "@/lib/pair/step-draw";

function p(
  id: string,
  name: string,
  extra: Partial<PairParticipant> = {},
): PairParticipant {
  return { id, name, joinedAt: 1000, ...extra };
}

describe("parseDefaultPinSpec", () => {
  it("returns [] when unset or empty", () => {
    expect(parseDefaultPinSpec(undefined)).toEqual([]);
    expect(parseDefaultPinSpec("")).toEqual([]);
  });

  it("parses one group", () => {
    expect(parseDefaultPinSpec("Hoà Hồ|Lê Hoạt")).toEqual([
      ["Hoà Hồ", "Lê Hoạt"],
    ]);
  });

  it("parses multiple groups and trims", () => {
    expect(parseDefaultPinSpec(" A | B ; C|D ")).toEqual([
      ["A", "B"],
      ["C", "D"],
    ]);
  });

  it("drops groups with fewer than 2 names", () => {
    expect(parseDefaultPinSpec("Solo;A|B")).toEqual([["A", "B"]]);
  });

  it("accepts newlines as a group separator", () => {
    expect(parseDefaultPinSpec("A|B\nC|D\r\nE|F")).toEqual([
      ["A", "B"],
      ["C", "D"],
      ["E", "F"],
    ]);
  });
});

describe("resolveDefaultPinSpec", () => {
  it("falls back to the built-in constant when env is unset or blank", () => {
    const builtIn = parseDefaultPinSpec(BUILT_IN_DEFAULT_PINS);
    expect(resolveDefaultPinSpec(undefined)).toEqual(builtIn);
    expect(resolveDefaultPinSpec("  ")).toEqual(builtIn);
  });

  it("env overrides the built-in constant", () => {
    expect(resolveDefaultPinSpec("X|Y")).toEqual([["X", "Y"]]);
  });

  // Cặp cố định giờ cấu hình trong /admin/settings (site_settings), nên hằng
  // số trong code để rỗng: không ghim gì khi admin chưa nhập.
  it("is off by default so the draw stays fully random", () => {
    expect(BUILT_IN_DEFAULT_PINS).toBe("");
    expect(resolveDefaultPinSpec(undefined)).toEqual([]);
  });
});

describe("fallbackPinSpec", () => {
  it("prefers env over the built-in constant", () => {
    expect(fallbackPinSpec("A|B")).toBe("A|B");
    expect(fallbackPinSpec("  ")).toBe(BUILT_IN_DEFAULT_PINS);
    expect(fallbackPinSpec(undefined)).toBe(BUILT_IN_DEFAULT_PINS);
  });
});

describe("parsePinSetting", () => {
  it("reads the spec out of the stored shape", () => {
    expect(parsePinSetting({ spec: "A|B" })).toBe("A|B");
    // Chuỗi rỗng đã lưu là cố ý tắt, phải phân biệt với "chưa cấu hình" (null).
    expect(parsePinSetting({ spec: "" })).toBe("");
    expect(parsePinSetting("A|B")).toBe("A|B");
  });

  it("returns null when nothing usable is stored", () => {
    expect(parsePinSetting(null)).toBeNull();
    expect(parsePinSetting({})).toBeNull();
    expect(parsePinSetting({ spec: 42 })).toBeNull();
  });
});

describe("applyDefaultPins", () => {
  const roster = () => [
    p("p1", "Nguyễn An"),
    p("p2", "Hoà Hồ"),
    p("p3", "Trần Bình"),
    p("p4", "Lê Hoạt"),
  ];

  it("returns the same array when no groups configured", () => {
    const list = roster();
    expect(applyDefaultPins(list, [])).toBe(list);
  });

  it("gives both matched names one shared pin", () => {
    const res = applyDefaultPins(roster(), [["Hoà Hồ", "Lê Hoạt"]]);
    const hoa = res.find((x) => x.id === "p2")!;
    const hoat = res.find((x) => x.id === "p4")!;
    expect(hoa.pin).toBeTruthy();
    expect(hoa.pin).toBe(hoat.pin);
    expect(res.find((x) => x.id === "p1")!.pin).toBeUndefined();
  });

  it("matches regardless of diacritics, case and spacing", () => {
    const res = applyDefaultPins(roster(), [["hoa  ho", "LE HOAT"]]);
    expect(res.find((x) => x.id === "p2")!.pin).toBe(
      res.find((x) => x.id === "p4")!.pin,
    );
  });

  it("ignores a group when one name is missing", () => {
    const list = roster();
    const res = applyDefaultPins(list, [["Hoà Hồ", "Không Có Ai"]]);
    expect(res).toBe(list);
  });

  it("never overrides a hand pin", () => {
    const list = [
      p("p1", "Hoà Hồ", { pin: "manual" }),
      p("p2", "Lê Hoạt"),
      p("p3", "Khác"),
    ];
    const res = applyDefaultPins(list, [["Hoà Hồ", "Lê Hoạt"]]);
    expect(res).toBe(list);
    expect(res[0]!.pin).toBe("manual");
  });

  it("skips a group larger than groupSize instead of truncating it", () => {
    const list = [...roster(), p("p5", "Phạm Cường")];
    const spec = [["Hoà Hồ", "Lê Hoạt", "Phạm Cường"]];
    expect(applyDefaultPins(list, spec, 2)).toBe(list);
    // fits when the lobby actually has room for 3
    const ok = applyDefaultPins(list, spec, 3);
    expect(ok).not.toBe(list);
    expect(ok.find((x) => x.id === "p5")!.pin).toBe(
      ok.find((x) => x.id === "p2")!.pin,
    );
  });

  it("pins the pair into the same group across every seed", () => {
    const base = [
      ...roster(),
      p("p5", "E"),
      p("p6", "F"),
      p("p7", "G"),
      p("p8", "H"),
    ];
    const pinned = applyDefaultPins(base, [["Hoà Hồ", "Lê Hoạt"]]);
    for (let seed = 1; seed <= 50; seed++) {
      const res = shuffleParticipants(pinned, 2, seed, 1);
      const group = res.groups.find((g) => g.includes("p2"))!;
      expect(group).toContain("p4");
      expect(res.byes).toHaveLength(0);
      expect(new Set(res.groups.flat()).size).toBe(8);
    }
  });

  it("step draw keeps the pinned pair together on the very first spin", () => {
    const base = [
      ...roster(),
      p("p5", "E"),
      p("p6", "F"),
      p("p7", "G"),
      p("p8", "H"),
    ];
    const pinned = applyDefaultPins(base, [["Hoà Hồ", "Lê Hoạt"]], 2);
    for (let seed = 1; seed <= 50; seed++) {
      const out = drawNextGroup(pinned, 2, { groups: [], byes: [] }, seed);
      expect(out.fromPin).toBe(true);
      expect(out.group!.slice().sort()).toEqual(["p2", "p4"]);
    }
  });

  it("drawAllRemaining keeps the pinned pair in one group", () => {
    const base = [
      ...roster(),
      p("p5", "E"),
      p("p6", "F"),
      p("p7", "G"),
      p("p8", "H"),
    ];
    const pinned = applyDefaultPins(base, [["Hoà Hồ", "Lê Hoạt"]], 2);
    for (let seed = 1; seed <= 50; seed++) {
      const { next } = drawAllRemaining(
        pinned,
        2,
        { groups: [], byes: [] },
        seed,
      );
      const group = next.groups.find((g) => g.includes("p2"))!;
      expect(group).toContain("p4");
      expect(next.byes).toHaveLength(0);
      expect(new Set(next.groups.flat()).size).toBe(8);
    }
  });
});
