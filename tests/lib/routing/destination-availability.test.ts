import { describe, expect, it } from "vitest";
import { getAvailableDestinations } from "@/lib/routing";
import { CAMPFIRE_HEALTH_THRESHOLD, ELITE_HEALTH_THRESHOLD, SHOP_MIN_GOLD } from "@/lib/game-constants";

const MAX_HEALTH = 30;
const campfireFloor = Math.floor(MAX_HEALTH * CAMPFIRE_HEALTH_THRESHOLD);
const eliteFloor = Math.floor(MAX_HEALTH * ELITE_HEALTH_THRESHOLD);

describe("getAvailableDestinations", () => {
  it("excludes Equipment Shop when no gear is owned (Armory locked)", () => {
    const destinations = getAvailableDestinations(MAX_HEALTH, 100, MAX_HEALTH, false);
    expect(destinations).not.toContain("Equipment Shop");
  });

  it("includes Equipment Shop when gear is owned and gold meets the shop minimum", () => {
    const destinations = getAvailableDestinations(MAX_HEALTH, SHOP_MIN_GOLD, MAX_HEALTH, true);
    expect(destinations).toContain("Equipment Shop");
  });
  it("never includes Boss Combat", () => {
    const destinations = getAvailableDestinations(MAX_HEALTH, 100, MAX_HEALTH);
    expect(destinations).not.toContain("Boss Combat");
  });

  it("excludes Campfire when Health reaches the campfire threshold of max", () => {
    const destinations = getAvailableDestinations(campfireFloor, 100, MAX_HEALTH);
    expect(destinations).not.toContain("Campfire");
  });

  it("includes Campfire when Health is just below the campfire threshold", () => {
    const destinations = getAvailableDestinations(campfireFloor - 1, 100, MAX_HEALTH);
    expect(destinations).toContain("Campfire");
  });

  it("includes Campfire when Health is low regardless of thresholds", () => {
    const destinations = getAvailableDestinations(eliteFloor - 2, 100, MAX_HEALTH);

    expect(destinations).toContain("Campfire");
  });

  it("excludes shops when gold is just below the shop minimum", () => {
    for (const shop of ["Card Shop", "Alchemist's Shop", "Trinket Shop", "Equipment Shop"]) {
      const destinations = getAvailableDestinations(MAX_HEALTH, SHOP_MIN_GOLD - 1, MAX_HEALTH);
      expect(destinations).not.toContain(shop);
    }
  });

  it("includes shops when gold meets the shop minimum", () => {
    for (const shop of ["Card Shop", "Alchemist's Shop", "Trinket Shop", "Equipment Shop"]) {
      const destinations = getAvailableDestinations(MAX_HEALTH, SHOP_MIN_GOLD, MAX_HEALTH, true);
      expect(destinations).toContain(shop);
    }
  });

  it("excludes Elite Combat when Health is just below half max", () => {
    const destinations = getAvailableDestinations(eliteFloor - 1, 100, MAX_HEALTH);
    expect(destinations).not.toContain("Elite Combat");
  });

  it("includes Elite Combat when Health reaches half max", () => {
    const destinations = getAvailableDestinations(eliteFloor, 100, MAX_HEALTH);
    expect(destinations).toContain("Elite Combat");
  });

  it("returns Normal Combat, Mystery, and remaining destinations", () => {
    const destinations = getAvailableDestinations(MAX_HEALTH, 100, MAX_HEALTH);
    expect(destinations).toContain("Normal Combat");
    expect(destinations).toContain("Mystery");
  });
});
