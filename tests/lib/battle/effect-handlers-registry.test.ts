import { describe, expect, it } from "vitest";
import { BATTLE_CARD_EFFECT_KINDS, RECURSIVE_BATTLE_CARD_EFFECT_KINDS } from "@/lib/game-data";
import { EFFECT_APPLY_BY_KIND } from "@/lib/battle/effect-handlers/registry";

describe("battle effect-handlers registry", () => {
  it("provides an apply handler for every registered kind except recursive kinds", () => {
    const recursive = new Set<string>(RECURSIVE_BATTLE_CARD_EFFECT_KINDS);
    const registered = new Set(Object.keys(EFFECT_APPLY_BY_KIND));
    for (const kind of BATTLE_CARD_EFFECT_KINDS) {
      expect(registered.has(kind)).toBe(!recursive.has(kind));
    }
  });

  it("registry size matches non-recursive kinds", () => {
    expect(Object.keys(EFFECT_APPLY_BY_KIND)).toHaveLength(
      BATTLE_CARD_EFFECT_KINDS.length - RECURSIVE_BATTLE_CARD_EFFECT_KINDS.length,
    );
  });
});
