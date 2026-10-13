import { describe, expect, it } from "vitest";
import { applyCrowdControlTriggerBonuses, applyLuckyCloverGold } from "@/lib/battle/bonus-effects";
import type { CombatTextEvent } from "@/lib/battle/types";
import { patchBattleState } from "../../fixtures/battle";

describe("applyCrowdControlTriggerBonuses", () => {
  it("strips both defenses in order, reports only removed amounts, and preserves the input", () => {
    const state = patchBattleState({ enemyMitigation: { armor: 5, block: 6, forge: 3 } });
    const before = structuredClone({ ...state, rng: undefined });
    const texts: CombatTextEvent[] = [];
    const result = applyCrowdControlTriggerBonuses(state, { stripArmor: true, stripBlock: true }, texts);
    expect(result.enemyMitigation).toEqual({ armor: 0, block: 0, forge: 3 });
    expect(texts).toEqual([
      { target: "enemy", kind: "damage", stat: "armor", amount: 5, impact: false },
      { target: "enemy", kind: "damage", stat: "block", amount: 6, impact: false },
    ]);
    expect({ ...state, rng: undefined }).toEqual(before);
    const emptyTexts: CombatTextEvent[] = [];
    applyCrowdControlTriggerBonuses(result, { stripArmor: true, stripBlock: true }, emptyTexts);
    expect(emptyTexts).toEqual([]);
  });

  it("adds combined block once so flatBlockGained applies a single time", () => {
    const state = patchBattleState({
      gearEffects: { flatBlockGained: 2, blockOnStun: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCrowdControlTriggerBonuses(state, { block: 4 + 3 }, texts);
    expect(result.playerStatuses.block).toBe(9);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 9 }]);
  });

  it("restores mana and emits combat text", () => {
    const state = patchBattleState({ mana: 1 });
    const texts: CombatTextEvent[] = [];
    const result = applyCrowdControlTriggerBonuses(state, { mana: 2 }, texts);
    expect(result.mana).toBe(3);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "mana", amount: 2 }]);
  });
});

describe("applyLuckyCloverGold", () => {
  it("combat text shows scaled gold when goldGainPercent gear is active", () => {
    const state = patchBattleState({
      trinketEffects: { luckyCloverGoldChance: 50 },
      gearEffects: { goldGainPercent: 50 },
      rng: () => 0.01,
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 10, texts);
    expect(next.gold).toBe(15);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 15 }]);
  });

  it.each([
    { chance: 50, damage: 7, roll: 0.99 },
    { chance: 0, damage: 7, roll: 0.01 },
    { chance: 50, damage: 0, roll: 0.01 },
    { chance: 50, damage: -3, roll: 0.01 },
  ])("leaves Gold and feedback untouched at $chance% chance and $damage damage", ({ chance, damage, roll }) => {
    const state = patchBattleState({ trinketEffects: { luckyCloverGoldChance: chance }, rng: () => roll });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, damage, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });
});
