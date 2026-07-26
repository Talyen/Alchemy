import { describe, expect, it } from "vitest";
import { gearDefinitions, getInventoryFootprint } from "@/lib/gear";

describe("getInventoryFootprint", () => {
  it("uses the selected slot footprint for filtered inventory", () => {
    const body = gearDefinitions["leather-armor-basic"];

    expect(getInventoryFootprint(body, null)).toEqual({ w: 2, h: 3 });
    expect(getInventoryFootprint(body, "left-ring")).toEqual({ w: 1, h: 1 });
  });

  it("uses the expanded equipment footprints", () => {
    expect(getInventoryFootprint(gearDefinitions["hatchet-basic"], null)).toEqual({ w: 2, h: 3 });
    expect(getInventoryFootprint(gearDefinitions["leather-buckler-basic"], null)).toEqual({ w: 2, h: 3 });
    expect(getInventoryFootprint(gearDefinitions["leather-belt-basic"], null)).toEqual({ w: 2, h: 1 });
  });
});
