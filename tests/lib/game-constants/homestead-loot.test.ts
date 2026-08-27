import { describe, expect, it } from "vitest";
import { HOMESTEAD_LOOT_CONFIG } from "@/lib/game-constants/homestead-loot";

describe("homestead loot constants", () => {
  it("orders enemy type multipliers by difficulty", () => {
    const { normal, elite, boss } = HOMESTEAD_LOOT_CONFIG.enemyTypeMultipliers;
    expect(normal).toBeGreaterThan(0);
    expect(elite).toBeGreaterThan(normal);
    expect(boss).toBeGreaterThan(elite);
  });
});
