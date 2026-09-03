import { describe, expect, it } from "vitest";
import {
  BATTLE_CARD_EFFECT_KINDS,
  BattleCardEffectSchema,
  ENEMY_STATUS_DAMAGE_IDS,
  ENEMY_STATUS_IDS,
  EnemyStatusDamageIdSchema,
  EnemyStatusIdSchema,
  RECURSIVE_BATTLE_CARD_EFFECT_KINDS,
  TEMPLATE_EFFECT_DEFINITIONS,
} from "@/lib/game-data";

describe("effect dispatch registry", () => {
  it("template definitions cover all non-recursive kinds", () => {
    const recursive = new Set<string>(RECURSIVE_BATTLE_CARD_EFFECT_KINDS);
    expect(TEMPLATE_EFFECT_DEFINITIONS).toHaveLength(BATTLE_CARD_EFFECT_KINDS.length - recursive.size);
    const templateKinds = new Set<string>(TEMPLATE_EFFECT_DEFINITIONS.map((def) => def.kind));
    for (const kind of BATTLE_CARD_EFFECT_KINDS) {
      if (recursive.has(kind)) {
        expect(templateKinds.has(kind)).toBe(false);
      } else {
        expect(templateKinds.has(kind)).toBe(true);
      }
    }
  });

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
