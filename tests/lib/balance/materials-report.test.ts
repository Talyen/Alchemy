import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMaterialsBalanceReport } from "@/lib/balance/materials-report";

import * as materialRewards from "@/lib/homestead/material-rewards";

describe("materials balance report", () => {
  afterEach(() => vi.restoreAllMocks());
  it("reports every progression band and encounter type through the live loot policy, averaging every material", () => {
    const loot = vi.spyOn(materialRewards, "getCombatMaterialLoot");
    let sample = 0;
    loot.mockImplementation((type) => {
      const amount = (sample++ % 2) + (type === "boss" ? 3 : 1);
      return {
        wood: amount,
        stone: amount * 2,
        iron: amount * 3,
        food: amount * 4,
        herbs: amount * 5,
        hide: amount * 6,
        gems: amount * 7,
      };
    });
    const report = buildMaterialsBalanceReport(2);
    const expectedPairs = [1, 2, 3].flatMap((progressionBand) =>
      (["normal", "elite", "boss"] as const).map((enemyType) => ({ progressionBand, enemyType })),
    );
    expect(report.rows.map(({ progressionBand, enemyType }) => ({ progressionBand, enemyType }))).toEqual(
      expectedPairs,
    );
    expect(loot).toHaveBeenCalledTimes(expectedPairs.length * 2);
    for (const [index, { progressionBand, enemyType }] of expectedPairs.entries()) {
      expect(loot).toHaveBeenNthCalledWith(index * 2 + 1, enemyType, progressionBand, expect.any(Function));
      const mean = enemyType === "boss" ? 3.5 : 1.5;
      expect(report.rows[index]!.mean).toEqual({
        wood: mean,
        stone: mean * 2,
        iron: mean * 3,
        food: mean * 4,
        herbs: mean * 5,
        hide: mean * 6,
        gems: mean * 7,
      });
    }
  });

  it("rejects invalid sample counts", () => {
    expect(() => buildMaterialsBalanceReport(0)).toThrow("positive integer");
    expect(() => buildMaterialsBalanceReport(1.5)).toThrow("positive integer");
    expect(() => buildMaterialsBalanceReport(100_001)).toThrow("capped");
  });
});
