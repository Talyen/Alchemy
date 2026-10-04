import { describe, expect, it } from "vitest";
import { BattleCardEffectSchema } from "@/lib/game-data";

describe("effect dispatch registry", () => {
  // Template/handler/keyword coverage for every kind lives in
  // effect-kind-coverage.test.ts; this file pins schema refinements.
  it("rejects bonus-only statuses where a damage status is required", () => {
    expect(
      BattleCardEffectSchema.safeParse({ kind: "multiply-enemy-status", status: "burnBonus", factor: 2 }).success,
    ).toBe(false);
    expect(BattleCardEffectSchema.safeParse({ kind: "remove-player-status", status: "onAttackBleed" }).success).toBe(
      false,
    );
    expect(BattleCardEffectSchema.safeParse({ kind: "enemy-status", status: "thorns", amount: 2 }).success).toBe(true);
  });
  it("round-trips nested saved effects without stripping conditional fields or runtime empty branches", () => {
    const scheduled = {
      kind: "repeat-over-turns",
      remainingTurns: 2,
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [
            { kind: "damage", damageType: "physical", amount: 3, ignoreArmor: true, ignoreBlock: true },
            { kind: "player-status", status: "block", statusPool: ["block", "forge", "armor"], amount: 5 },
            { kind: "restore-mana", amount: 1, ifEnemyFrozen: true, allowOverflow: true },
          ],
          failureEffects: [],
        },
      ],
    };
    expect(BattleCardEffectSchema.parse(scheduled)).toEqual(scheduled);
  });

  it.each([
    { doubleIfEnemyBurning: true, tripleIfEnemyNotBurning: true },
    { doubleIfEnemyBurning: true, doubleIfEnemyNotBurning: true },
    { doubleIfEnemyNotBurning: true, tripleIfEnemyNotBurning: true },
    { detonateAllBurn: true, detonateIfEnemyBurning: true },
    { equalToBlockPercent: 50 },
    { equalToBlock: true, equalToArmor: true },
  ])("rejects conflicting or incomplete damage selectors: %j", (flags) => {
    expect(BattleCardEffectSchema.safeParse({ kind: "damage", damageType: "burn", amount: 1, ...flags }).success).toBe(
      false,
    );
  });

  it("preserves each independent Burning multiplier, including explicitly disabled alternatives", () => {
    for (const flag of ["doubleIfEnemyBurning", "doubleIfEnemyNotBurning", "tripleIfEnemyNotBurning"] as const) {
      const effect = {
        kind: "damage",
        damageType: "burn",
        amount: 2,
        doubleIfEnemyBurning: false,
        doubleIfEnemyNotBurning: false,
        tripleIfEnemyNotBurning: false,
        [flag]: true,
      };
      expect(BattleCardEffectSchema.parse(effect), flag).toEqual(effect);
    }
  });

  it("rejects broken conditional damage inside saved chance branches", () => {
    const result = BattleCardEffectSchema.safeParse({
      kind: "chance",
      probability: 0.5,
      successEffects: [{ kind: "damage", damageType: "physical", amount: 2, blockCost: 1 }],
      failureEffects: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["successEffects", 0]);
    expect(BattleCardEffectSchema.safeParse({ kind: "remove-enemy-armor", amount: 2, halve: true }).success).toBe(
      false,
    );
  });

  it("rejects random-damage with max < min", () => {
    expect(BattleCardEffectSchema.safeParse({ kind: "random-damage", minAmount: 10, maxAmount: 5 }).success).toBe(
      false,
    );
  });
});
