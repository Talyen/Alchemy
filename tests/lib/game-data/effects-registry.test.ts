import { describe, expect, it } from "vitest";
import {
  BATTLE_CARD_EFFECT_KINDS,
  BattleCardEffectSchema,
  ENEMY_STATUS_DAMAGE_IDS,
  ENEMY_STATUS_IDS,
  EnemyStatusDamageIdSchema,
  EnemyStatusIdSchema,
  TEMPLATE_EFFECT_DEFINITIONS,
} from "@/lib/game-data";

describe("effect dispatch registry", () => {
  // Template/handler/keyword coverage for every kind lives in
  // effect-kind-coverage.test.ts; this file pins schema refinements.
  it("has no duplicate kinds", () => {
    expect(new Set(BATTLE_CARD_EFFECT_KINDS).size).toBe(BATTLE_CARD_EFFECT_KINDS.length);
  });

  it("status schemas match the canonical status id lists", () => {
    expect([...EnemyStatusIdSchema.options]).toEqual([...ENEMY_STATUS_IDS]);
    expect([...EnemyStatusDamageIdSchema.options]).toEqual([...ENEMY_STATUS_DAMAGE_IDS]);
  });

  it("rejects bonus-only statuses where a damage status is required", () => {
    expect(
      BattleCardEffectSchema.safeParse({ kind: "multiply-enemy-status", status: "burnBonus", factor: 2 }).success,
    ).toBe(false);
    expect(BattleCardEffectSchema.safeParse({ kind: "remove-player-status", status: "onAttackBleed" }).success).toBe(
      false,
    );
    expect(BattleCardEffectSchema.safeParse({ kind: "enemy-status", status: "thorns", amount: 2 }).success).toBe(true);
  });
  it("every template definition carries a Zod schema", () => {
    for (const def of TEMPLATE_EFFECT_DEFINITIONS) {
      expect(def.schema).toBeDefined();
    }
  });

  it("parses representative effect schemas via BattleCardEffectSchema", () => {
    expect(BattleCardEffectSchema.safeParse({ kind: "damage", damageType: "physical", amount: 3 }).success).toBe(true);
    expect(BattleCardEffectSchema.safeParse({ kind: "enemy-status", status: "poison", amount: 2 }).success).toBe(true);
    expect(BattleCardEffectSchema.safeParse({ kind: "gain-gold", amount: 5 }).success).toBe(true);
    expect(
      BattleCardEffectSchema.safeParse({
        kind: "chance" as const,
        probability: 0.5,
        successEffects: [{ kind: "heal", amount: 1 }],
        failureEffects: [{ kind: "heal", amount: 1 }],
      }).success,
    ).toBe(true);
  });

  it("preserves conditional effect fields used by saved cards", () => {
    expect(
      BattleCardEffectSchema.parse({
        kind: "damage",
        damageType: "burn",
        amount: 2,
        doubleIfEnemyBurning: true,
      }),
    ).toMatchObject({ doubleIfEnemyBurning: true });
    expect(BattleCardEffectSchema.parse({ kind: "restore-mana", amount: 1, ifEnemyFrozen: true })).toMatchObject({
      ifEnemyFrozen: true,
    });
    expect(BattleCardEffectSchema.parse({ kind: "gain-gold", amount: 2, ifEnemyStunned: true })).toMatchObject({
      ifEnemyStunned: true,
    });
    expect(BattleCardEffectSchema.parse({ kind: "player-status", status: "thorns", amount: 2 })).toMatchObject({
      status: "thorns",
    });
    expect(BattleCardEffectSchema.parse({ kind: "next-archery-free" })).toMatchObject({
      kind: "next-archery-free",
    });
    expect(
      BattleCardEffectSchema.parse({
        kind: "damage",
        damageType: "burn",
        amount: 1,
        detonateAllBurn: true,
      }),
    ).toMatchObject({ detonateAllBurn: true });
    expect(
      BattleCardEffectSchema.parse({
        kind: "damage",
        damageType: "bleed",
        amount: 1,
        detonateAllBleed: true,
        doubleIfEnemyNotBurning: true,
      }),
    ).toMatchObject({ detonateAllBleed: true, doubleIfEnemyNotBurning: true });
    expect(
      BattleCardEffectSchema.parse({
        kind: "damage",
        damageType: "holy",
        amount: 0,
        equalToBlock: true,
        equalToBlockPercent: 50,
      }),
    ).toMatchObject({ equalToBlock: true, equalToBlockPercent: 50 });
    expect(
      BattleCardEffectSchema.parse({
        kind: "damage",
        damageType: "physical",
        amount: 3,
        ignoreArmor: true,
        ignoreBlock: true,
      }),
    ).toMatchObject({ ignoreArmor: true, ignoreBlock: true });
    expect(BattleCardEffectSchema.parse({ kind: "remove-enemy-armor", halve: true })).toMatchObject({ halve: true });
    expect(
      BattleCardEffectSchema.parse({
        kind: "player-status",
        status: "block",
        statusPool: ["block", "forge", "armor"],
        amount: 5,
      }),
    ).toMatchObject({ statusPool: ["block", "forge", "armor"] });
  });

  it("rejects mutually exclusive damage flags", () => {
    expect(
      BattleCardEffectSchema.safeParse({
        kind: "damage",
        damageType: "physical",
        amount: 3,
        doubleIfEnemyBurning: true,
        tripleIfEnemyNotBurning: true,
      }).success,
    ).toBe(false);
    for (const flags of [
      { doubleIfEnemyBurning: true, doubleIfEnemyNotBurning: true },
      { doubleIfEnemyNotBurning: true, tripleIfEnemyNotBurning: true },
    ]) {
      expect(
        BattleCardEffectSchema.safeParse({ kind: "damage", damageType: "burn", amount: 1, ...flags }).success,
      ).toBe(false);
    }
    expect(
      BattleCardEffectSchema.safeParse({
        kind: "damage",
        damageType: "burn",
        amount: 1,
        detonateAllBurn: true,
        detonateIfEnemyBurning: true,
      }).success,
    ).toBe(false);
    expect(
      BattleCardEffectSchema.safeParse({
        kind: "damage",
        damageType: "holy",
        amount: 0,
        equalToBlockPercent: 50,
      }).success,
    ).toBe(false);
    expect(BattleCardEffectSchema.safeParse({ kind: "remove-enemy-armor", amount: 2, halve: true }).success).toBe(
      false,
    );
    expect(
      BattleCardEffectSchema.safeParse({
        kind: "damage",
        damageType: "physical",
        amount: 0,
        equalToBlock: true,
        equalToArmor: true,
      }).success,
    ).toBe(false);
  });

  it("rejects random-damage with max < min", () => {
    expect(BattleCardEffectSchema.safeParse({ kind: "random-damage", minAmount: 10, maxAmount: 5 }).success).toBe(
      false,
    );
  });
});
