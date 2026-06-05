import { describe, expect, it } from "vitest";
import { BATTLE_CARD_EFFECT_KINDS } from "@/lib/game-data";
import { EFFECT_APPLY_BY_KIND, hasEffectApplyHandler } from "@/lib/battle/effect-handlers/registry";

describe("battle effect-handlers registry", () => {
  it("provides an apply handler for every registered kind except chance", () => {
    for (const kind of BATTLE_CARD_EFFECT_KINDS) {
      if (kind === "chance") {
        expect(hasEffectApplyHandler(kind)).toBe(false);
        continue;
      }
      expect(hasEffectApplyHandler(kind)).toBe(true);
      expect(EFFECT_APPLY_BY_KIND[kind]).toBeTypeOf("function");
    }
  });

  it("registry size matches non-chance kinds", () => {
    expect(Object.keys(EFFECT_APPLY_BY_KIND)).toHaveLength(BATTLE_CARD_EFFECT_KINDS.length - 1);
  });
});
