import { describe, expect, it } from "vitest";
import { DESTINATIONS, filterValidDestinations, filterValidDestinationRounds } from "@/lib/routing";

describe("filterValidDestinations", () => {
  it("remaps Merchant's Shop to Card Shop", () => {
    expect(filterValidDestinations(["Mystery", "Merchant's Shop", "Campfire"])).toEqual([
      DESTINATIONS.MYSTERY,
      DESTINATIONS.CARD_SHOP,
      DESTINATIONS.CAMPFIRE,
    ]);
  });

  it("drops unknown destination strings", () => {
    expect(filterValidDestinations(["Mystery", "Old Bazaar"])).toEqual([DESTINATIONS.MYSTERY]);
  });
});

describe("filterValidDestinationRounds", () => {
  it("remaps Merchant's Shop rounds onto Card Shop", () => {
    expect(filterValidDestinationRounds({ "Merchant's Shop": 4, Mystery: 1 })).toEqual({
      [DESTINATIONS.CARD_SHOP]: 4,
      [DESTINATIONS.MYSTERY]: 1,
    });
  });
});
