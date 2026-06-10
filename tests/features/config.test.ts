import { describe, expect, it } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import { getCurrentEnemy } from "@/features/alchemy/shared/config";

describe("getCurrentEnemy", () => {
  it("returns a non-skeleton enemy when no enemy type is specified", () => {
    const enemy = getCurrentEnemy();
    expect(enemy.id).not.toBe("skeleton");
  });

  it("never returns skeleton from the default pool", () => {
    for (let i = 0; i < 50; i++) {
      const enemy = getCurrentEnemy();
      expect(enemy.id).not.toBe("skeleton");
    }
  });

  it("returns a normal enemy when enemy type is normal", () => {
    const enemy = getCurrentEnemy("normal");
    expect(enemy.enemyType).toBe("normal");
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
