import { describe, expect, it } from "vitest";
import {
  getCenteredGridSlots,
  getDiscoveryPackGridLayout,
  isSingleDiscoveryRow,
} from "@/features/alchemy/shared/ui/discovery-pack-grid";
import { collectionCardGridClass, collectionTrinketGridClass } from "@/features/alchemy/shared/config";

describe("getDiscoveryPackGridLayout", () => {
  it("uses the collection card grid for card batches", () => {
    expect(getDiscoveryPackGridLayout(false)).toEqual({ gridClass: collectionCardGridClass, columnCount: 4 });
  });

  it("uses the collection trinket grid for trinket batches", () => {
    expect(getDiscoveryPackGridLayout(true)).toEqual({ gridClass: collectionTrinketGridClass, columnCount: 3 });
  });
});

describe("isSingleDiscoveryRow", () => {
  it("is true for one item", () => {
    expect(isSingleDiscoveryRow(["a"])).toBe(true);
  });

  it("is false for multiple items", () => {
    expect(isSingleDiscoveryRow(["a", "b"])).toBe(false);
  });
});

describe("getCenteredGridSlots", () => {
  it("centers two items in a four-column row", () => {
    expect(getCenteredGridSlots(["a", "b"], 4)).toEqual([null, "a", "b", null]);
  });

  it("centers one item in a four-column row", () => {
    expect(getCenteredGridSlots(["a"], 4)).toEqual([null, "a", null, null]);
  });

  it("centers one trinket in a three-column row", () => {
    expect(getCenteredGridSlots(["a"], 3)).toEqual([null, "a", null]);
  });
});
