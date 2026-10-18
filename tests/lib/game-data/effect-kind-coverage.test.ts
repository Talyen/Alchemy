import { expect, it } from "vitest";
import { BATTLE_CARD_EFFECT_KINDS, RECURSIVE_BATTLE_CARD_EFFECT_KINDS } from "@/lib/game-data";
import { EFFECT_APPLY_BY_KIND } from "@/lib/battle/effect-handlers/registry";

it("registers exactly the non-recursive effect kinds for battle dispatch", () => {
  const recursive = new Set<string>(RECURSIVE_BATTLE_CARD_EFFECT_KINDS);
  expect(Object.keys(EFFECT_APPLY_BY_KIND).sort()).toEqual(
    BATTLE_CARD_EFFECT_KINDS.filter((kind) => !recursive.has(kind)).sort(),
  );
});
