import { describe, expect, it } from "vitest";
import { enemiesByType } from "@/lib/game-data";
import { coreMatchupsForTier, coreScenarioSeeds, REPORT_TIERS, titleFor } from "@/lib/balance/report-catalog";

describe("report-catalog", () => {
  it("resolves catalog titles and preserves unknown IDs, including object property names", () => {
    expect(titleFor("enemy", "skeleton")).toBe("Skeleton");
    expect(titleFor("character", "knight")).toBe("Knight");
    for (const id of ["unknown-enemy", "constructor", "toString", "__proto__"]) {
      expect(titleFor("enemy", id)).toBe(id);
    }
  });

  it("covers every enemy at the intended depths in stable encounter order", () => {
    for (const tier of REPORT_TIERS) {
      const matchups = coreMatchupsForTier(tier);
      const grouped = new Map<string, number[]>();
      for (const row of matchups) {
        expect(enemiesByType[row.enemyType].some((enemy) => enemy.id === row.enemyId)).toBe(true);
        grouped.set(row.enemyId, [...(grouped.get(row.enemyId) ?? []), row.depth - tier.depthOffset]);
      }
      expect([...grouped.keys()]).toEqual(
        [...enemiesByType.normal, ...enemiesByType.elite, ...enemiesByType.boss].map((enemy) => enemy.id),
      );
      for (const enemy of enemiesByType.normal) expect(grouped.get(enemy.id)).toEqual([0, 3, 6]);
      for (const enemy of enemiesByType.elite) expect(grouped.get(enemy.id)).toEqual([2, 5, 7]);
      for (const enemy of enemiesByType.boss) expect(grouped.get(enemy.id)).toEqual([7]);
    }
  });

  it("shares class decks across enemies while keeping fight randomness distinct", () => {
    const skeleton = coreScenarioSeeds({
      tier: "late",
      characterId: "wizard",
      enemyId: "skeleton",
      depth: 23,
      deckIndex: 1,
    });
    const mimic = coreScenarioSeeds({
      tier: "late",
      characterId: "wizard",
      enemyId: "mimic",
      depth: 23,
      deckIndex: 1,
    });
    expect(skeleton.deckSeed).toBe(mimic.deckSeed);
    expect(skeleton.fightSeed).not.toBe(mimic.fightSeed);
  });
});
