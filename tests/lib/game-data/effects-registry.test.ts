import { describe, expect, it } from "vitest";
import {
  BATTLE_CARD_EFFECT_KINDS,
  BattleCardEffectSchema,
  REGISTERED_EFFECT_KINDS,
  TEMPLATE_EFFECT_DEFINITIONS,
} from "@/lib/game-data";

describe("effect dispatch registry", () => {
  it("registers every canonical effect kind", () => {
    expect(REGISTERED_EFFECT_KINDS).toEqual(BATTLE_CARD_EFFECT_KINDS);
  });

  it("template definitions cover all non-chance kinds", () => {
    expect(TEMPLATE_EFFECT_DEFINITIONS).toHaveLength(21);
    const templateKinds = new Set(TEMPLATE_EFFECT_DEFINITIONS.map((def) => def.kind));
    for (const kind of BATTLE_CARD_EFFECT_KINDS) {
      if (kind === "chance") {
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
});
