import { describe, expect, it } from "vitest";
import {
  buildDiscoveryPackPlan,
  chunkIds,
  computeRunDiscoveryDelta,
  hasRunEndDiscoveries,
} from "@/lib/discoveries";

describe("discoveries helpers", () => {
  it("computeRunDiscoveryDelta preserves current list order for new ids", () => {
    expect(computeRunDiscoveryDelta(["a", "b", "c", "d"], ["a", "c"])).toEqual(["b", "d"]);
  });

  it("chunkIds splits into batches of the requested size", () => {
    expect(chunkIds(["1", "2", "3", "4", "5", "6", "7"], 4)).toEqual([
      ["1", "2", "3", "4"],
      ["5", "6", "7"],
    ]);
  });

  it("buildDiscoveryPackPlan runs card packs before boon packs", () => {
    const plan = buildDiscoveryPackPlan(
      ["c1", "c2", "c3", "c4", "c5", "c6"],
      ["t1", "t2", "t3", "t4"],
    );
    expect(plan).toEqual([
      { kind: "cards", ids: ["c1", "c2", "c3", "c4"] },
      { kind: "cards", ids: ["c5", "c6"] },
      { kind: "boons", ids: ["t1", "t2", "t3"] },
      { kind: "boons", ids: ["t4"] },
    ]);
  });

  it("hasRunEndDiscoveries is false when both lists are empty", () => {
    expect(hasRunEndDiscoveries([], [])).toBe(false);
    expect(hasRunEndDiscoveries(["card-a"], [])).toBe(true);
    expect(hasRunEndDiscoveries([], ["boon-a"])).toBe(true);
  });
});
