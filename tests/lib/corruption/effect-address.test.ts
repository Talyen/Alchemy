import { describe, expect, it } from "vitest";
import { getCorruptionTargetEffect } from "@/lib/corruption/effect-address";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";

describe("Corruption effect addresses", () => {
  it("keeps success-before-failure addressing through nested scheduled effects", () => {
    const heal: BattleCardEffect = { kind: "heal", amount: 2 };
    const hit: BattleCardEffect = { kind: "damage", damageType: "burn", amount: 3 };
    const card: BattleCard = {
      id: "address-fixture",
      title: "Address fixture",
      art: "",
      cost: 0,
      descriptionLines: [],
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [heal],
          failureEffects: [{ kind: "repeat-over-turns", remainingTurns: 2, effects: [hit] }],
        },
      ],
    };
    expect(getCorruptionTargetEffect(card, { effectIndex: 0, effectPath: [0] })).toBe(heal);
    expect(getCorruptionTargetEffect(card, { effectIndex: 0, effectPath: [1, 0] })).toBe(hit);
    for (const path of [[2], [-1], [1, 1], [0, 0]]) {
      expect(getCorruptionTargetEffect(card, { effectIndex: 0, effectPath: path })).toBeUndefined();
    }
  });
});
