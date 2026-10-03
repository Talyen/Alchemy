import { describe, expect, it } from "vitest";
import { DESTINATIONS, filterValidDestinations, filterValidDestinationRounds } from "@/lib/routing";

describe("saved destinations", () => {
  it("repairs renamed shops and drops unknown destinations without losing route order", () => {
    expect(filterValidDestinations(["Mystery", "Merchant's Shop", "Old Bazaar", "Equipment Shop", "Campfire"])).toEqual(
      [DESTINATIONS.MYSTERY, DESTINATIONS.CARD_SHOP, DESTINATIONS.GEAR_SHOP, DESTINATIONS.CAMPFIRE],
    );
  });

  it("keeps valid offer history and rejects counters that would poison destination weighting", () => {
    expect(
      filterValidDestinationRounds({
        "Merchant's Shop": 4,
        "Equipment Shop": 2,
        Mystery: 0,
        Campfire: Number.POSITIVE_INFINITY,
        Corruption: Number.NaN,
        Transmutation: -1,
        "Old Bazaar": 5,
      }),
    ).toEqual({
      [DESTINATIONS.CARD_SHOP]: 4,
      [DESTINATIONS.GEAR_SHOP]: 2,
      [DESTINATIONS.MYSTERY]: 0,
    });
  });
});
