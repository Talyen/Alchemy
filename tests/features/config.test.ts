import { describe, expect, it } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import { getCurrentEnemy } from "@/features/alchemy/shared/config";

describe("getCurrentEnemy", () => {
  it("returns a normal enemy for room 0", () => {
    const enemy = getCurrentEnemy();
    expect(enemy).toBeDefined();
    expect(enemy.id).toBeDefined();
  });

  it("returns a non-skeleton enemy for room 1+", () => {
    for (let i = 0; i < 50; i++) {
      const enemy = getCurrentEnemy();
      expect(enemy.id).not.toBe("skeleton");
    }
  });

  it("always returns an enemy even with high room count", () => {
    for (let i = 0; i < 50; i++) {
      const enemy = getCurrentEnemy();
      expect(enemy).toBeDefined();
      expect(enemy.id).toBeDefined();
    }
  });

  it("prefers normal enemies not encountered this run", () => {
    const normalEnemies = enemyBestiary.filter((enemy) => enemy.enemyType === "normal");
    const remaining = normalEnemies[normalEnemies.length - 1];
    const encountered = normalEnemies.slice(0, -1).map((enemy) => enemy.id);

    expect(getCurrentEnemy("normal", encountered).id).toBe(remaining.id);
  });

  it("prefers elite enemies not encountered this run", () => {
    const eliteEnemies = enemyBestiary.filter((enemy) => enemy.enemyType === "elite");
    const remaining = eliteEnemies[eliteEnemies.length - 1];
    const encountered = eliteEnemies.slice(0, -1).map((enemy) => enemy.id);

    expect(getCurrentEnemy("elite", encountered).id).toBe(remaining.id);
  });

  it("falls back to the requested enemy type after all were encountered", () => {
    const eliteEnemyIds = enemyBestiary.filter((enemy) => enemy.enemyType === "elite").map((enemy) => enemy.id);

    expect(getCurrentEnemy("elite", eliteEnemyIds).enemyType).toBe("elite");
  });
});
