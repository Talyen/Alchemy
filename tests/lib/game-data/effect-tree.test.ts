import { describe, expect, it } from "vitest";
import { mapEffectChildren, visitBattleCardEffects, type BattleCardEffect } from "@/lib/game-data";

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
  it("keeps Corruption child addresses stable across success and failure branches", () => {
    const chance: BattleCardEffect = {
      kind: "chance",
      probability: 0.5,
      successEffects: [
        { kind: "heal", amount: 1 },
        { kind: "restore-mana", amount: 2 },
      ],
      failureEffects: [{ kind: "gain-gold", amount: 3 }],
    };
    const before = structuredClone(chance);
    expect(mapEffectChildren(chance, (child) => child)).toBe(chance);
    const mapped = mapEffectChildren(chance, (_child, index) => ({ kind: "gain-gold", amount: index + 1 }));
    expect(mapped).toEqual({
      ...chance,
      successEffects: [
        { kind: "gain-gold", amount: 1 },
        { kind: "gain-gold", amount: 2 },
      ],
      failureEffects: [{ kind: "gain-gold", amount: 3 }],
    });
    expect(chance).toEqual(before);

    const partial = mapEffectChildren(chance, (child, index) =>
      index === 2 ? { kind: "gain-gold", amount: 4 } : child,
    );
    expect(partial.kind).toBe("chance");
    if (partial.kind !== "chance") throw new Error("Expected chance");
    expect(partial.successEffects).toEqual(chance.successEffects);
    expect(partial.successEffects).not.toBe(chance.successEffects);
    expect(partial.failureEffects[0]).toEqual({ kind: "gain-gold", amount: 4 });
    const copied = mapEffectChildren(chance, (child) => child, false);
    expect(copied).not.toBe(chance);
    if (copied.kind !== "chance") throw new Error("Expected chance");
    expect(copied.successEffects).not.toBe(chance.successEffects);
    expect(copied.failureEffects).not.toBe(chance.failureEffects);
  });

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
    { match: "gain-gold", expected: ["chance", "repeat-over-turns", "heal", "damage", "gain-gold"] },
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
