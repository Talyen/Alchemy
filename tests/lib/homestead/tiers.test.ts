import { describe, expect, it } from "vitest";
import { createEmptyTierRecord, type TieredItem } from "@/lib/homestead/tiers";

const testItems: Array<TieredItem<"a" | "b" | "c">> = [
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
