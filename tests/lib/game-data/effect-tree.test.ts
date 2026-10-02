import { describe, expect, it } from "vitest";
import { visitBattleCardEffects, type BattleCardEffect } from "@/lib/game-data";

function nestedEffects(): BattleCardEffect[] {
  return [
    {
      kind: "chance",
      probability: 0.5,
      successEffects: [
        {
          kind: "repeat-over-turns",
          remainingTurns: 2,
          effects: [
            { kind: "heal", amount: 1 },
            { kind: "damage", damageType: "burn", amount: 2 },
          ],
        },
      ],
      failureEffects: [{ kind: "gain-gold", amount: 3 }],
    },
    { kind: "restore-mana", amount: 1 },
  ];
}

describe("visitBattleCardEffects", () => {
  it("visits wrappers and nested effects in authored order without changing the tree", () => {
    const effects = nestedEffects();
    const before = structuredClone(effects);
    const visited: Array<BattleCardEffect["kind"]> = [];
    const stopped = visitBattleCardEffects(effects, (effect) => {
      visited.push(effect.kind);
    });

    expect(stopped).toBe(false);
    expect(visited).toEqual(["chance", "repeat-over-turns", "heal", "damage", "gain-gold", "restore-mana"]);
    expect(effects).toEqual(before);
  });

  it.each([
    { match: "repeat-over-turns", expected: ["chance", "repeat-over-turns"] },
    { match: "heal", expected: ["chance", "repeat-over-turns", "heal"] },
  ])("stops the whole walk at $match", ({ match, expected }) => {
    const visited: Array<BattleCardEffect["kind"]> = [];
    const stopped = visitBattleCardEffects(nestedEffects(), (effect) => {
      visited.push(effect.kind);
      return effect.kind === match;
    });

    expect(stopped).toBe(true);
    expect(visited).toEqual(expected);
  });
});
