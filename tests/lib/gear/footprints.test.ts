import { describe, expect, it } from "vitest";
import {
  definitionOfferFootprintKey,
  eligibleOfferFootprintKeys,
  GEAR_PORTRAIT_FOOTPRINT,
  GEAR_PORTRAIT_FOOTPRINT_KEY,
  gearDefinitions,
} from "@/lib/gear";

describe("gear offer footprints", () => {
  it("uses a single 3:4 portrait family for remaining gear", () => {
    expect(definitionOfferFootprintKey(gearDefinitions["leather-armor-basic"]!)).toBe(GEAR_PORTRAIT_FOOTPRINT_KEY);
    expect(definitionOfferFootprintKey(gearDefinitions["hatchet-basic"]!)).toBe(GEAR_PORTRAIT_FOOTPRINT_KEY);
    expect(definitionOfferFootprintKey(gearDefinitions["ruby-ring-basic"]!)).toBe(GEAR_PORTRAIT_FOOTPRINT_KEY);
    expect(GEAR_PORTRAIT_FOOTPRINT).toEqual({ w: 3, h: 4 });
  });

  it("lists the portrait family when enough unique base items exist", () => {
    expect(eligibleOfferFootprintKeys(3)).toEqual([GEAR_PORTRAIT_FOOTPRINT_KEY]);
  });
});
