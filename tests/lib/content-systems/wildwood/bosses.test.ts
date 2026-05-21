// Unit tests for Wildwood boss definitions — data integrity via compendium.
import { describe, expect, it } from "vitest";
import { WILDWOOD_BOSS_IDS } from "@/lib/content-systems/wildwood/bosses";
import { enemyBestiary } from "@/lib/game-data";

describe("WILDWOOD_BOSS_IDS", () => {
  it("contains exactly 4 entries", () => {
    expect(WILDWOOD_BOSS_IDS).toHaveLength(4);
  });

  it("each bossId exists in enemyBestiary", () => {
    for (const bossId of WILDWOOD_BOSS_IDS) {
      const enemy = enemyBestiary.find((e) => e.id === bossId);
      expect(enemy).toBeDefined();
      expect(enemy!.enemyType).toBe("boss");
    }
  });

  it("each boss has at least one trait and one attack effect", () => {
    for (const bossId of WILDWOOD_BOSS_IDS) {
      const enemy = enemyBestiary.find((e) => e.id === bossId)!;
      expect(enemy.traits.length).toBeGreaterThan(0);
      expect(enemy.attackEffects.length).toBeGreaterThan(0);
    }
  });
});
