import { describe, expect, it } from "vitest";
import { applyCrowdControlTriggerBonuses, applyLuckyCloverGold } from "@/lib/battle/bonus-effects";
import type { CombatTextEvent } from "@/lib/battle/types";
import { defaultGearEffects } from "@/lib/gear";
import { patchBattleState } from "../../fixtures/battle";
import { defaultTrinketManifest } from "../../fixtures/default-battle-state";

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
      trinketEffects: defaultTrinketManifest({ luckyCloverGoldChance: 50 }),
      gearEffects: { ...defaultGearEffects, goldGainPercent: 50 },
      rng: () => 0.01,
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 10, texts);
    expect(next.gold).toBe(15);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 15 }]);
  });

  it("does nothing when random does not trigger", () => {
    const state = patchBattleState({
      trinketEffects: defaultTrinketManifest({ luckyCloverGoldChance: 50 }),
      rng: () => 0.99,
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 7, texts);
    expect(next.gold).toBe(0);
    expect(texts).toEqual([]);
  });

  it("does nothing when luckyCloverGoldChance is 0", () => {
    const state = patchBattleState();
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 7, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });

  it("does nothing when damage is 0", () => {
    const state = patchBattleState({
      trinketEffects: defaultTrinketManifest({ luckyCloverGoldChance: 50 }),
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 0, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });

  it("does nothing when damage is negative", () => {
    const state = patchBattleState({
      trinketEffects: defaultTrinketManifest({ luckyCloverGoldChance: 50 }),
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, -3, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });
});
