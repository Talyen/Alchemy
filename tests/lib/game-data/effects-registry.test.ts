import { describe, expect, it } from "vitest";
import {
  BATTLE_CARD_EFFECT_KINDS,
  BattleCardEffectSchema,
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
        failureEffects: [],
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
  });
});
