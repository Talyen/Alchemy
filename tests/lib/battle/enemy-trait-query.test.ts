import { describe, expect, it } from "vitest";
import { getEnemyTraitSet, hasEnemyTrait } from "@/lib/battle/enemy-trait-query";
import { makeTestBattleState } from "../../fixtures/battle";

describe("enemy trait query", () => {
  it("supports direct and cached trait lookup", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      currentEnemy: {
        ...base.currentEnemy,
        traits: [{ id: "vampire", title: "Vampire", description: "" }],
      },
    });
    const traits = getEnemyTraitSet(state);
    expect(hasEnemyTrait(state, "vampire")).toBe(true);
    expect(hasEnemyTrait(state, "vampire", traits)).toBe(true);
    expect(hasEnemyTrait(state, "cleric", traits)).toBe(false);
  });
});
