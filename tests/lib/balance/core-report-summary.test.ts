import { describe, expect, it } from "vitest";
import { summarizeCoreRates, type CoreRateRow } from "@/lib/balance/core-report-summary";
import { reportCharacterIds } from "@/lib/balance/report-catalog";
import { emptyRateCell } from "@/lib/balance/report-rankings";

function row(
  identity: Pick<CoreRateRow, "characterId" | "enemyId" | "enemyType" | "tier">,
  wins: number,
  n: number,
  cardPlayCounts: Record<string, number>,
): CoreRateRow {
  return {
    ...identity,
    cell: { ...emptyRateCell(), wins, losses: n - wins, n, winRate: wins / n },
    cardPlayCounts,
  };
}

describe("core balance report summaries", () => {
  it("keeps battle weights, equal enemy-type weights, and late card counts distinct", () => {
    const knightSkeleton = { characterId: "knight", enemyId: "skeleton", enemyType: "normal" } as const;
    const rows = [
      row({ ...knightSkeleton, tier: "early" }, 10, 100, { poison: 500 }),
      row({ ...knightSkeleton, tier: "late" }, 9, 10, { slash: 3 }),
      row({ ...knightSkeleton, tier: "late" }, 2, 5, { slash: 4, block: 2 }),
      row({ characterId: "knight", enemyId: "mimic", enemyType: "elite", tier: "late" }, 1, 3, { block: 5 }),
      row({ characterId: "wizard", enemyId: "skeleton", enemyType: "normal", tier: "late" }, 2, 2, { "holy-bolt": 8 }),
    ];
    const before = structuredClone(rows);
    const summary = summarizeCoreRates(rows);

    const skeleton = summary.enemies.find(({ id }) => id === "skeleton")!;
    expect(skeleton.rates.late.n).toBe(17);
    expect(skeleton.rates.late.winRate).toBeCloseTo(13 / 17);
    expect(skeleton.rates.early.n).toBe(100);
    expect(skeleton.rates.mid).toEqual(emptyRateCell());

    const knight = summary.classes.find(({ id }) => id === "knight")!;
    expect(knight.rates.late.n).toBe(18);
    expect(knight.ratesByType.late.normal.winRate).toBeCloseTo(11 / 15);
    expect(knight.ratesByType.late.elite.winRate).toBeCloseTo(1 / 3);
    expect(knight.ratesByType.late.boss).toEqual(emptyRateCell());
    expect(knight.rates.late.winRate).toBeCloseTo((11 / 15 + 1 / 3) / 2);

    expect(summary.classMatchups.map(({ characterId, enemyId }) => [characterId, enemyId])).toEqual([
      ["knight", "mimic"],
      ["knight", "skeleton"],
      ["wizard", "skeleton"],
    ]);
    const matchup = summary.classMatchups[1]!;
    expect(matchup.enemyType).toBe("normal");
    expect(matchup.rates.late.n).toBe(15);
    expect(matchup.topCardsLate).toEqual([
      { cardId: "slash", count: 7 },
      { cardId: "block", count: 2 },
    ]);
    expect(summary.classMatchups[2]!.topCardsLate).toEqual([{ cardId: "holy-bolt", count: 8 }]);
    expect(rows).toEqual(before);
  });

  it("retains unsampled heroes with empty rates in stable catalog order", () => {
    const summary = summarizeCoreRates([]);
    expect(summary.enemies).toEqual([]);
    expect(summary.classMatchups).toEqual([]);
    expect(summary.classes.map(({ id }) => id)).toEqual(reportCharacterIds());
    for (const hero of summary.classes) {
      expect(hero.rates).toEqual({ early: emptyRateCell(), mid: emptyRateCell(), late: emptyRateCell() });
      expect(hero.ratesByType.late).toEqual({
        normal: emptyRateCell(),
        elite: emptyRateCell(),
        boss: emptyRateCell(),
      });
    }
  });
});
