import { describe, expect, it } from "vitest";
import { getAvailableDestinations, getBossEnemy } from "@/features/alchemy/config";
import { enemyBestiary } from "@/lib/game-data";

describe("getAvailableDestinations", () => {
  it("never includes Boss Combat", () => {
    const destinations = getAvailableDestinations(30, 100, 30);
    expect(destinations).not.toContain("Boss Combat");
  });

  it("excludes Campfire when Health >= 80% of max and >= half max", () => {
    const destinations = getAvailableDestinations(24, 100, 30); // 80% = 24
    expect(destinations).not.toContain("Campfire");
  });

  it("includes Campfire when Health is below 80%", () => {
    const destinations = getAvailableDestinations(23, 100, 30);
    expect(destinations).toContain("Campfire");
  });

  it("includes Campfire when Health is at 80% but below half Max", () => {
    const destinations = getAvailableDestinations(12, 100, 30); // 40% Health, 80% threshold = 24
    // 12 >= floor(30*0.8)=24 is false, 12 >= 15 is false → campfire included
    expect(destinations).toContain("Campfire");
  });

  it("excludes Merchant's Shop when gold < 40", () => {
    const destinations = getAvailableDestinations(30, 39, 30);
    expect(destinations).not.toContain("Merchant's Shop");
  });

  it("includes Merchant's Shop when gold >= 40", () => {
    const destinations = getAvailableDestinations(30, 40, 30);
    expect(destinations).toContain("Merchant's Shop");
  });

  it("excludes Alchemist's Shop when gold < 40", () => {
    const destinations = getAvailableDestinations(30, 39, 30);
    expect(destinations).not.toContain("Alchemist's Shop");
  });

  it("includes Alchemist's Shop when gold >= 40", () => {
    const destinations = getAvailableDestinations(30, 40, 30);
    expect(destinations).toContain("Alchemist's Shop");
  });

  it("excludes Elite Combat when Health < half max", () => {
    const destinations = getAvailableDestinations(14, 100, 30);
    expect(destinations).not.toContain("Elite Combat");
  });

  it("includes Elite Combat when Health >= half max", () => {
    const destinations = getAvailableDestinations(15, 100, 30);
    expect(destinations).toContain("Elite Combat");
  });

  it("returns Normal Combat, Mystery, and remaining destinations", () => {
    const destinations = getAvailableDestinations(30, 100, 30);
    expect(destinations).toContain("Normal Combat");
    expect(destinations).toContain("Mystery");
  });
});

describe("getBossEnemy", () => {
  it("returns a random boss from the full boss pool", () => {
    const boss = getBossEnemy();
    expect(boss.enemyType).toBe("boss");
    expect(["forge-golem", "frostwarden", "blight-treant", "iron-bear"]).toContain(boss.id);
  });

  it("returns a boss from the full pool on repeated calls", () => {
    for (let i = 0; i < 5; i++) {
      const boss = getBossEnemy();
      expect(boss.enemyType).toBe("boss");
    }
  });

  it("prefers bosses not encountered this run", () => {
    const bosses = enemyBestiary.filter((enemy) => enemy.enemyType === "boss");
    const remaining = bosses[bosses.length - 1];
    const encountered = bosses.slice(0, -1).map((enemy) => enemy.id);

    expect(getBossEnemy(encountered).id).toBe(remaining.id);
  });

  it("falls back to the boss pool after all bosses were encountered", () => {
    const bossIds = enemyBestiary.filter((enemy) => enemy.enemyType === "boss").map((enemy) => enemy.id);

    expect(getBossEnemy(bossIds).enemyType).toBe("boss");
  });
});
