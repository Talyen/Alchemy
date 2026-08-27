import { describe, expect, it } from "vitest";
import { BATTLE_CARD_EFFECT_KINDS, RECURSIVE_BATTLE_CARD_EFFECT_KINDS } from "@/lib/game-data/effects/kinds";
import { TEMPLATE_EFFECT_DEFINITIONS } from "@/lib/game-data/effects/template-definitions";

describe("BATTLE_CARD_EFFECT_KINDS single-source guard", () => {
  it("contains every template kind plus recursive kinds, no extras", () => {
    const templateKinds = TEMPLATE_EFFECT_DEFINITIONS.map((d) => d.kind);
    const expected = new Set([...templateKinds, ...RECURSIVE_BATTLE_CARD_EFFECT_KINDS]);
    expect(new Set(BATTLE_CARD_EFFECT_KINDS)).toEqual(expected);
  });

  it("has no duplicates", () => {
    expect(new Set(BATTLE_CARD_EFFECT_KINDS).size).toBe(BATTLE_CARD_EFFECT_KINDS.length);
  });
});
