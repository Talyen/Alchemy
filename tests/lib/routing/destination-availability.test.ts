import { describe, expect, it } from "vitest";
import { getAvailableDestinations } from "@/lib/routing";
import { ELITE_HEALTH_THRESHOLD, SHOP_MIN_GOLD } from "@/lib/game-constants";

const MAX_HEALTH = 31;
const eliteFloor = Math.round(MAX_HEALTH * ELITE_HEALTH_THRESHOLD);
const freeDestinations = ["Normal Combat", "Mystery", "Corruption", "Transmutation", "Campfire"];
const affordableDestinations = [
  "Normal Combat",
  "Card Shop",
  "Alchemist's Shop",
  "Trinket Shop",
  "Gear Shop",
  "Mystery",
  "Corruption",
  "Transmutation",
  "Campfire",
];

describe("destination eligibility", () => {
  it("keeps free actions available and excludes all shops below their Gold floor", () => {
    expect(getAvailableDestinations(eliteFloor - 1, SHOP_MIN_GOLD - 1, MAX_HEALTH)).toEqual(freeDestinations);
    expect(getAvailableDestinations(eliteFloor - 1, SHOP_MIN_GOLD, MAX_HEALTH)).toEqual(affordableDestinations);
  });

  it("opens Elite Combat at the rounded Health boundary without offering Boss Combat", () => {
    expect(getAvailableDestinations(eliteFloor, SHOP_MIN_GOLD, MAX_HEALTH)).toEqual([
      affordableDestinations[0],
      "Elite Combat",
      ...affordableDestinations.slice(1),
    ]);
  });

  it("removes only the unavailable Gear and Trinket shops, including a completed collection", () => {
    expect(getAvailableDestinations(eliteFloor - 1, SHOP_MIN_GOLD, MAX_HEALTH, false, true)).toEqual(
      affordableDestinations.filter((destination) => destination !== "Gear Shop"),
    );
    expect(getAvailableDestinations(eliteFloor - 1, SHOP_MIN_GOLD, MAX_HEALTH, true, false)).toEqual(
      affordableDestinations.filter((destination) => destination !== "Trinket Shop"),
    );
  });
});
