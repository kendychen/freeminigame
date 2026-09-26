import { describe, it, expect } from "vitest";
import { isGroupStageComplete, type PicGroup, type PicMatch } from "@/stores/pic-tournament";

function match(id: string, status: PicMatch["status"]): PicMatch {
  return {
    id,
    round: 1,
    stage: "group",
    a1: "p1", a2: "p2",
    b1: "p3", b2: "p4",
    scoreA: 0, scoreB: 0,
    status,
  };
}

function group(label: string, matches: PicMatch[]): PicGroup {
  return { id: label, label, playerIds: ["p1", "p2", "p3", "p4"], matches };
}

describe("isGroupStageComplete", () => {
  it("false when no group match has been generated", () => {
    expect(isGroupStageComplete([group("A", []), group("B", [])])).toBe(false);
  });

  it("ignores groups that have no match to play", () => {
    // bảng < 4 VĐV không sinh trận → không được chặn vòng bảng vô hạn
    expect(isGroupStageComplete([group("A", []), group("B", [match("m1", "completed")])])).toBe(true);
  });

  it("false when no group exists", () => {
    expect(isGroupStageComplete([])).toBe(false);
  });

  it("false while any match is pending", () => {
    const groups = [group("A", [match("m1", "completed"), match("m2", "pending")])];
    expect(isGroupStageComplete(groups)).toBe(false);
  });

  it("true when every generated match is completed", () => {
    const groups = [
      group("A", [match("m1", "completed"), match("m2", "completed")]),
      group("B", [match("m3", "completed")]),
    ];
    expect(isGroupStageComplete(groups)).toBe(true);
  });
});
