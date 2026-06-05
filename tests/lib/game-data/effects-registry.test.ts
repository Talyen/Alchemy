import { describe, expect, it } from "vitest";
import {
  ALL_EFFECT_REGISTRY_ENTRIES,
  BATTLE_CARD_EFFECT_KINDS,
  BattleCardEffectSchema,
  getEffectDispatchRoute,
  REGISTERED_EFFECT_KINDS,
  TEMPLATE_EFFECT_DEFINITIONS,
} from "@/lib/game-data";

describe("effect dispatch registry", () => {
  it("registers every canonical effect kind", () => {
    expect(REGISTERED_EFFECT_KINDS).toEqual(BATTLE_CARD_EFFECT_KINDS);
    expect(ALL_EFFECT_REGISTRY_ENTRIES).toHaveLength(BATTLE_CARD_EFFECT_KINDS.length);
    for (const kind of BATTLE_CARD_EFFECT_KINDS) {
      expect(getEffectDispatchRoute(kind)).toBeDefined();
    }
    expect(getEffectDispatchRoute("not-a-real-kind" as "damage")).toBeUndefined();
  });

  it("routes mana and utility kinds consistently", () => {
    expect(getEffectDispatchRoute("restore-mana")).toBe("mana");
    expect(getEffectDispatchRoute("gain-gold")).toBe("utility");
    expect(getEffectDispatchRoute("enemy-status")).toBe("enemy-status");
  });

  it("keeps template definition modules aligned with registry routes", () => {
    expect(TEMPLATE_EFFECT_DEFINITIONS).toHaveLength(21);
    for (const def of TEMPLATE_EFFECT_DEFINITIONS) {
      expect(getEffectDispatchRoute(def.kind)).toBe(def.dispatchRoute);
    }
    expect(getEffectDispatchRoute("chance")).toBe("chance");
  });

  it("parses representative effect schemas via BattleCardEffectSchema", () => {
    expect(
      BattleCardEffectSchema.safeParse({ kind: "damage", damageType: "physical", amount: 3 }).success,
    ).toBe(true);
    expect(
      BattleCardEffectSchema.safeParse({ kind: "enemy-status", status: "poison", amount: 2 }).success,
    ).toBe(true);
    expect(BattleCardEffectSchema.safeParse({ kind: "gain-gold", amount: 5 }).success).toBe(true);
    expect(
      BattleCardEffectSchema.safeParse({
        kind: "chance",
        probability: 0.5,
        successEffects: [{ kind: "heal", amount: 1 }],
        failureEffects: [],
      }).success,
    ).toBe(true);
  });
});
