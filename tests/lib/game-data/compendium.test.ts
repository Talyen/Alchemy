import { describe, expect, it } from "vitest";
import {
  bossEnemies,
  encounterEnemies,
  enemiesByType,
  enemyBestiary,
  enemyById,
  isEnemyId,
  isTrinketId,
  trinketById,
  trinketLibrary,
} from "@/lib/game-data";
import { collectUncoveredEnemyTraitIds } from "@/lib/battle/enemy-turn-traits";

describe("Compendium catalog contracts", () => {
  it("gives every enemy one to three unique supported native Traits", () => {
    for (const enemy of enemyBestiary) {
      const ids = enemy.traits.map((trait) => trait.id);
      expect(ids.length, enemy.id).toBeGreaterThanOrEqual(1);
      expect(ids.length, enemy.id).toBeLessThanOrEqual(3);
      expect(new Set(ids).size, enemy.id).toBe(ids.length);
      expect(collectUncoveredEnemyTraitIds(ids), enemy.id).toEqual([]);
    }
  });

  it("resolves every catalog ID and rejects inherited object properties as content", () => {
    expect(Object.keys(enemyById)).toEqual(enemyBestiary.map((enemy) => enemy.id));
    expect(Object.keys(trinketById)).toEqual(trinketLibrary.map((trinket) => trinket.id));
    for (const enemy of enemyBestiary) {
      expect(isEnemyId(enemy.id), enemy.id).toBe(true);
      expect(enemyById[enemy.id], enemy.id).toBe(enemy);
    }
    for (const trinket of trinketLibrary) {
      expect(isTrinketId(trinket.id), trinket.id).toBe(true);
      expect(trinketById[trinket.id], trinket.id).toBe(trinket);
    }
    for (const id of ["missing", "", "constructor", "__proto__", "toString"]) {
      expect(isEnemyId(id), id).toBe(false);
      expect(isTrinketId(id), id).toBe(false);
    }
  });

  it("keeps encounter pools complete and partitions every enemy exactly once", () => {
    expect(encounterEnemies).toBe(enemyBestiary);
    expect(bossEnemies).toBe(enemiesByType.boss);
    const partitioned = Object.values(enemiesByType).flat();
    expect(partitioned).toHaveLength(enemyBestiary.length);
    expect(new Set(partitioned)).toEqual(new Set(enemyBestiary));
    for (const [type, enemies] of Object.entries(enemiesByType)) {
      expect(
        enemies.every((enemy) => enemy.enemyType === type),
        type,
      ).toBe(true);
    }
  });
});
