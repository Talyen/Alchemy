import { describe, expect, it } from "vitest";
import {
  applyCrowdControlTriggerBonuses,
  applyIronwoodBuckler,
  applyLuckyCloverGold,
} from "@/lib/battle/bonus-effects";
import { defaultTalentEffects } from "@/lib/battle";
import { FREE_CARD_SENTINEL } from "@/lib/game-constants";
import type { CombatTextEvent } from "@/lib/battle/types";
import { defaultGearEffects } from "@/lib/gear";
import { makeTestBattleState, makeTestCardWithId, patchBattleState } from "../../fixtures/battle";
import { defaultPlayerStatusValues, defaultTrinketManifest } from "../../fixtures/default-battle-state";

describe("applyCrowdControlTriggerBonuses", () => {
  it("no-ops when all bonuses are empty", () => {
    const state = makeTestBattleState({
      deck: [makeTestCardWithId("d1")],
      hand: [],
    });
    const result = applyCrowdControlTriggerBonuses(state, {});
    expect(result).toBe(state);
  });

  it("draws N cards", () => {
    const state = makeTestBattleState({
      deck: [makeTestCardWithId("d1"), makeTestCardWithId("d2"), makeTestCardWithId("d3")],
      hand: [],
      discard: [],
      rng: () => 0,
    });
    const result = applyCrowdControlTriggerBonuses(state, { draw: 2 });
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(1);
  });

  it("sets FREE_CARD_SENTINEL when nextCardFree is true", () => {
    const result = applyCrowdControlTriggerBonuses(makeTestBattleState(), { nextCardFree: true });
    expect(result.flags.nextCardCostReduction).toBe(FREE_CARD_SENTINEL);
  });

  it("adds combined block once so flatBlockGained applies a single time", () => {
    const state = makeTestBattleState({
      talentEffects: { ...defaultTalentEffects, blockOnStun: 4 },
      gearEffects: { ...makeTestBattleState().gearEffects, flatBlockGained: 2, blockOnStun: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCrowdControlTriggerBonuses(state, { block: 4 + 3 }, texts);
    expect(result.playerStatuses.block).toBe(9);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 9 }]);
  });

  it("grants forge through addForgeToPlayer", () => {
    const texts: CombatTextEvent[] = [];
    const result = applyCrowdControlTriggerBonuses(makeTestBattleState(), { forge: 2 }, texts);
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("strips enemy armor", () => {
    const state = makeTestBattleState({
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, armor: 5 },
    });
    const result = applyCrowdControlTriggerBonuses(state, { stripArmor: true });
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("strips enemy Block", () => {
    const state = makeTestBattleState({
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, block: 6 },
    });
    const result = applyCrowdControlTriggerBonuses(state, { stripBlock: true });
    expect(result.enemyMitigation.block).toBe(0);
  });

  it("restores mana and emits combat text", () => {
    const state = makeTestBattleState({ mana: 1 });
    const texts: CombatTextEvent[] = [];
    const result = applyCrowdControlTriggerBonuses(state, { mana: 2 }, texts);
    expect(result.mana).toBe(3);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "mana", amount: 2 }]);
  });
});

describe("applyIronwoodBuckler", () => {
  it("converts block to armor when block >= threshold", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ block: 10 }),
      trinketEffects: defaultTrinketManifest({ blockToArmorThreshold: 5, blockToArmorAmount: 3 }),
    });
    const texts: CombatTextEvent[] = [];
    const next = applyIronwoodBuckler(state, texts);
    expect(next.playerStatuses.armor).toBe(3);
    expect(next.playerStatuses.block).toBe(10);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "armor", amount: 3 }]);
  });

  it("does nothing when block is below threshold", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ block: 3 }),
      trinketEffects: defaultTrinketManifest({ blockToArmorThreshold: 5, blockToArmorAmount: 3 }),
    });
    const texts: CombatTextEvent[] = [];
    const next = applyIronwoodBuckler(state, texts);
    expect(next.playerStatuses.armor).toBe(0);
    expect(texts).toEqual([]);
  });

  it("does nothing when threshold is 0 (boon not owned)", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ block: 10 }) });
    const texts: CombatTextEvent[] = [];
    const next = applyIronwoodBuckler(state, texts);
    expect(next.playerStatuses.armor).toBe(0);
    expect(texts).toEqual([]);
  });

  it("does not mutate original state", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ block: 10 }),
      trinketEffects: defaultTrinketManifest({ blockToArmorThreshold: 5, blockToArmorAmount: 3 }),
    });
    const texts: CombatTextEvent[] = [];
    applyIronwoodBuckler(state, texts);
    expect(state.playerStatuses.armor).toBe(0);
  });
});

describe("applyLuckyCloverGold", () => {
  it("grants gold on damage when luckyCloverGoldChance triggers", () => {
    const state = patchBattleState({
      trinketEffects: defaultTrinketManifest({ luckyCloverGoldChance: 50 }),
      rng: () => 0.01,
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 7, texts);
    expect(next.gold).toBe(7);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 7 }]);
  });

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
