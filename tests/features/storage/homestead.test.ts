import { describe, expect, it, vi, afterEach } from "vitest";
import { normalizeTierRecord } from "@/lib/homestead/tiers";
import {
  migrateMaterialInventory,
  migrateBuildingIds,
  migrateFarmIds,
} from "@/features/alchemy/shared/storage/homestead";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("migrateMaterialInventory", () => {
  it("returns default inventory for null/undefined", () => {
    const result = migrateMaterialInventory(null);
    expect(result).toEqual({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
  });

  it("returns default inventory for non-object", () => {
    const result = migrateMaterialInventory("invalid");
    expect(result).toEqual({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
  });

  it("preserves existing values and fills missing with 0", () => {
    const result = migrateMaterialInventory({ wood: 10, iron: 5 });
    expect(result).toEqual({ wood: 10, iron: 5, herbs: 0, food: 0, crystal: 0 });
  });

  it("preserves all five materials", () => {
    const result = migrateMaterialInventory({ wood: 1, iron: 2, herbs: 3, food: 4, crystal: 5 });
    expect(result).toEqual({ wood: 1, iron: 2, herbs: 3, food: 4, crystal: 5 });
  });

  it("ignores unknown properties", () => {
    const result = migrateMaterialInventory({ wood: 10, unknown: 999 });
    expect(result).not.toHaveProperty("unknown");
    expect(result.wood).toBe(10);
  });
});

describe("migrateBuildingIds", () => {
  it("returns empty array for non-array input", () => {
    expect(migrateBuildingIds(null)).toEqual([]);
    expect(migrateBuildingIds("string")).toEqual([]);
    expect(migrateBuildingIds(undefined)).toEqual([]);
  });

  it("renames smithy to blacksmiths-forge", () => {
    const result = migrateBuildingIds(["smithy", "hunters-lodge"]);
    expect(result).toEqual(["blacksmiths-forge", "hunters-lodge"]);
  });

  it("passes through non-renamed IDs as-is", () => {
    const result = migrateBuildingIds(["alchemy-lab", "hunters-lodge"]);
    expect(result).toEqual(["alchemy-lab", "hunters-lodge"]);
  });

  it("handles empty array", () => {
    expect(migrateBuildingIds([])).toEqual([]);
  });

  it("handles mixed renamed and unknown IDs", () => {
    const result = migrateBuildingIds(["smithy", "unknown-building", "alchemy-lab"]);
    expect(result).toEqual(["blacksmiths-forge", "unknown-building", "alchemy-lab"]);
  });
});

describe("migrateFarmIds", () => {
  it("returns empty array for non-array input", () => {
    expect(migrateFarmIds(null)).toEqual([]);
    expect(migrateFarmIds(42)).toEqual([]);
  });

  it("renames sheep-pasture to pasture", () => {
    const result = migrateFarmIds(["sheep-pasture", "wheat-field"]);
    expect(result).toEqual(["pasture", "wheat-field"]);
  });

  it("passes through non-renamed IDs as-is", () => {
    const result = migrateFarmIds(["herb-garden", "chicken-coop"]);
    expect(result).toEqual(["herb-garden", "chicken-coop"]);
  });

  it("handles empty array", () => {
    expect(migrateFarmIds([])).toEqual([]);
  });
});

describe("normalizeTierRecord", () => {
  const testItems = [
    { id: "alpha", tiers: [1, 2] },
    { id: "beta", tiers: [1] },
  ] as const;

  it("returns zero-filled record for null/undefined input", () => {
    const result = normalizeTierRecord(null, testItems);
    expect(result).toEqual({ alpha: 0, beta: 0 });
  });

  it("handles legacy array format (each entry gets level 1)", () => {
    const result = normalizeTierRecord(["alpha"], testItems);
    expect(result).toEqual({ alpha: 1, beta: 0 });
  });

  it("handles record format", () => {
    const result = normalizeTierRecord({ alpha: 2, beta: 1 }, testItems);
    expect(result).toEqual({ alpha: 2, beta: 1 });
  });

  it("clamps levels to max tier count", () => {
    const result = normalizeTierRecord({ alpha: 999 }, testItems);
    expect(result.alpha).toBe(2);
  });

  it("applies rename map", () => {
    const renameMap = { old_alpha: "alpha" as const };
    const result = normalizeTierRecord({ old_alpha: 1 }, testItems, renameMap);
    expect(result).toEqual({ alpha: 1, beta: 0 });
  });

  it("ignores unknown IDs", () => {
    const result = normalizeTierRecord({ unknown: 5 }, testItems);
    expect(result).toEqual({ alpha: 0, beta: 0 });
  });
});
