import { describe, expect, it } from "vitest";
import { createEmptyTierRecord, normalizeTierRecord, type TieredItem } from "@/lib/homestead/tiers";

const testItems: TieredItem<"a" | "b" | "c">[] = [
  { id: "a", tiers: [1, 2, 3] },
  { id: "b", tiers: [1, 2] },
  { id: "c", tiers: [1] },
];

describe("createEmptyTierRecord", () => {
  it("creates zero-filled record", () => {
    const result = createEmptyTierRecord(testItems);
    expect(result).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("handles empty items", () => {
    const result = createEmptyTierRecord([]);
    expect(result).toEqual({});
  });
});

describe("normalizeTierRecord", () => {
  it("handles undefined/null value", () => {
    expect(normalizeTierRecord(undefined, testItems)).toEqual({ a: 0, b: 0, c: 0 });
    expect(normalizeTierRecord(null, testItems)).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("handles empty array (legacy format)", () => {
    expect(normalizeTierRecord([], testItems)).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("handles array with string IDs (legacy format)", () => {
    expect(normalizeTierRecord(["a", "c"], testItems)).toEqual({ a: 1, b: 0, c: 1 });
  });

  it("handles record format with level values", () => {
    expect(normalizeTierRecord({ a: 2, b: 1 }, testItems)).toEqual({ a: 2, b: 1, c: 0 });
  });

  it("handles record format with string level values", () => {
    expect(normalizeTierRecord({ a: "2", b: "1" } as Record<string, unknown>, testItems)).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("ignores unknown IDs", () => {
    expect(normalizeTierRecord({ a: 2, unknown: 5 }, testItems)).toEqual({ a: 2, b: 0, c: 0 });
  });

  it("clamps level at max tier count", () => {
    expect(normalizeTierRecord({ a: 10, b: 5 }, testItems)).toEqual({ a: 3, b: 2, c: 0 });
  });

  it("clamps level at minimum 0", () => {
    expect(normalizeTierRecord({ a: -1 }, testItems)).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("takes max when multiple entries affect same ID in array format", () => {
    expect(normalizeTierRecord(["a", "a", "b"], testItems)).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("applies rename map for legacy IDs", () => {
    const renameMap = { old_a: "a" as const, old_b: "b" as const };
    expect(normalizeTierRecord({ old_a: 2, old_b: 1 }, testItems, renameMap)).toEqual({ a: 2, b: 1, c: 0 });
  });

  it("applies rename map for array format", () => {
    const renameMap = { old_a: "a" as const };
    expect(normalizeTierRecord(["old_a", "unknown"], testItems, renameMap)).toEqual({ a: 1, b: 0, c: 0 });
  });

  it("applies rename map and clamps", () => {
    const renameMap = { old_a: "a" as const };
    expect(normalizeTierRecord({ old_a: 100 }, testItems, renameMap)).toEqual({ a: 3, b: 0, c: 0 });
  });

  it("handles floating-point level values by flooring", () => {
    expect(normalizeTierRecord({ a: 2.7 }, testItems)).toEqual({ a: 2, b: 0, c: 0 });
  });
});
