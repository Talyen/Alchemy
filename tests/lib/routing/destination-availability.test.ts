import { describe, expect, it } from "vitest";
import { DESTINATIONS, getAvailableDestinations } from "@/lib/routing";
import { ELITE_HEALTH_THRESHOLD, SHOP_MIN_GOLD } from "@/lib/game-constants";

const MAX_HEALTH = 31;
const eliteFloor = Math.round(MAX_HEALTH * ELITE_HEALTH_THRESHOLD);
const freeDestinations = [
  DESTINATIONS.NORMAL_COMBAT,
  DESTINATIONS.MYSTERY,
  DESTINATIONS.CORRUPTION,
  DESTINATIONS.TRANSMUTATION,
  DESTINATIONS.CAMPFIRE,
];
const affordableDestinations = [
  DESTINATIONS.NORMAL_COMBAT,
  DESTINATIONS.CARD_SHOP,
  DESTINATIONS.ALCHEMIST_SHOP,
  DESTINATIONS.TRINKET_SHOP,
  DESTINATIONS.GEAR_SHOP,
  DESTINATIONS.MYSTERY,
  DESTINATIONS.CORRUPTION,
  DESTINATIONS.TRANSMUTATION,
  DESTINATIONS.CAMPFIRE,
];

describe("destination eligibility", () => {
  it("keeps Campfire brewing available at maximum Health", () => {
    for (const health of [MAX_HEALTH - 1, MAX_HEALTH, MAX_HEALTH + 1])
      expect(getAvailableDestinations(health, SHOP_MIN_GOLD, MAX_HEALTH)).toContain(DESTINATIONS.CAMPFIRE);
  });
  it("keeps free actions available and excludes all shops below their Gold floor", () => {
    expect(getAvailableDestinations(eliteFloor - 1, SHOP_MIN_GOLD - 1, MAX_HEALTH)).toEqual(freeDestinations);
    expect(getAvailableDestinations(eliteFloor - 1, SHOP_MIN_GOLD, MAX_HEALTH)).toEqual(affordableDestinations);
  });

  it("opens Elite Combat at the rounded Health boundary without offering Boss Combat", () => {
    expect(getAvailableDestinations(eliteFloor, SHOP_MIN_GOLD, MAX_HEALTH)).toEqual([
      affordableDestinations[0],
      DESTINATIONS.ELITE_COMBAT,
      ...affordableDestinations.slice(1),
    ]);
  });

  it("removes only the unavailable Gear and Trinket shops, including a completed collection", () => {
    expect(getAvailableDestinations(eliteFloor - 1, SHOP_MIN_GOLD, MAX_HEALTH, false, true)).toEqual(
      affordableDestinations.filter((destination) => destination !== DESTINATIONS.GEAR_SHOP),
    );
    expect(getAvailableDestinations(eliteFloor - 1, SHOP_MIN_GOLD, MAX_HEALTH, true, false)).toEqual(
      affordableDestinations.filter((destination) => destination !== DESTINATIONS.TRINKET_SHOP),
    );
  });
});
