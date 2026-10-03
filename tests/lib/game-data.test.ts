import { describe, expect, it } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import { placeholderEnemy } from "@/lib/game-data/assets";
import { CAMPFIRE_HEAL_FRACTION } from "@/lib/game-constants";
import { getCampfireHealFraction, getCampfireRestHealth } from "@/lib/campfire-heal";

describe("enemyBestiary data integrity", () => {
  it("uses the imported Will-o-Wisp art and no placeholder art remains", () => {
    const willOWisp = enemyBestiary.find((enemy) => enemy.id === "will-o-wisp")!;
    const bandit = enemyBestiary.find((enemy) => enemy.id === "bandit")!;
    expect(willOWisp.art).toBeTruthy();
    expect(bandit.art).toBeTruthy();
    expect(willOWisp.art).not.toBe(bandit.art);
    expect(enemyBestiary.filter((enemy) => enemy.art === placeholderEnemy)).toHaveLength(0);
  });
});

describe("campfire rest heal", () => {
  it("uses base fraction with no talent bonus", () => {
    expect(getCampfireHealFraction()).toBe(CAMPFIRE_HEAL_FRACTION);
    expect(getCampfireHealFraction(0)).toBe(CAMPFIRE_HEAL_FRACTION);
    expect(getCampfireRestHealth(10, 30)).toBe(19);
  });

  it("includes talent campfire heal bonus", () => {
    const healFraction = getCampfireHealFraction(0.1);
    expect(healFraction).toBe(0.4);
    expect(getCampfireRestHealth(10, 30, healFraction)).toBe(22);
  });

  it("clamps restored Health to max", () => {
    expect(getCampfireRestHealth(28, 30, CAMPFIRE_HEAL_FRACTION)).toBe(30);
    expect(getCampfireRestHealth(25, 30, 0.4)).toBe(30);
  });

  it("rounds fractional heal products", () => {
    expect(getCampfireRestHealth(10, 25)).toBe(18);
  });
});
