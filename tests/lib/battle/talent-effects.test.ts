import { describe, expect, it } from "vitest";
import {
  applyFreezeBlockTalent,
  applyFreezeStripArmorTalent,
  applyStunBlockTalent,
  applyStunDrawTalent,
  applyStunFreeCardTalent,
  applyStunManaTalent,
  applyStunStripArmorTalent,
} from "@/lib/battle/talent-effects";
import { defaultTalentEffects } from "@/lib/battle/draw";
import { FREE_CARD_SENTINEL } from "@/lib/game-constants";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";

function makeCard(id: string) {
  return { id, title: id, descriptionLines: [""], art: "", cost: 1, effects: [] };
}

describe("applyStunDrawTalent", () => {
  it("no-ops when drawOnStun is 0", () => {
    const state = createTestBattleState({
      deck: [makeCard("d1"), makeCard("d2")],
      hand: [],
      discard: [],
    });
    const result = applyStunDrawTalent(state);
    expect(result.hand).toEqual(state.hand);
    expect(result.deck).toEqual(state.deck);
  });

  it("draws N cards when drawOnStun > 0", () => {
    const state = createTestBattleState({
      deck: [makeCard("d1"), makeCard("d2"), makeCard("d3")],
      hand: [],
      discard: [],
      talentEffects: { ...defaultTalentEffects, drawOnStun: 2 },
      rng: () => 0,
    });
    const result = applyStunDrawTalent(state);
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(1);
  });
});

describe("applyStunFreeCardTalent", () => {
  it("sets FREE_CARD_SENTINEL when talent active", () => {
    const state = createTestBattleState({
      talentEffects: { ...defaultTalentEffects, nextCardFreeOnStun: true },
    });
    const result = applyStunFreeCardTalent(state);
    expect(result.flags.nextCardCostReduction).toBe(FREE_CARD_SENTINEL);
  });

  it("no-ops when nextCardFreeOnStun is false", () => {
    const state = createTestBattleState();
    const result = applyStunFreeCardTalent(state);
    expect(result.flags.nextCardCostReduction).toBe(0);
  });
});

describe("applyStunBlockTalent", () => {
  it("adds block and merges combat text", () => {
    const state = createTestBattleState({
      talentEffects: { ...defaultTalentEffects, blockOnStun: 4 },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyStunBlockTalent(state, texts);
    expect(result.playerStatuses.block).toBe(4);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 4 }]);
  });

  it("no-ops when amount is 0", () => {
    const state = createTestBattleState({ playerStatuses: { ...createTestBattleState().playerStatuses, block: 2 } });
    const result = applyStunBlockTalent(state);
    expect(result.playerStatuses.block).toBe(2);
  });
});

describe("applyFreezeBlockTalent", () => {
  it("adds block and merges combat text", () => {
    const state = createTestBattleState({
      talentEffects: { ...defaultTalentEffects, blockOnFreeze: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyFreezeBlockTalent(state, texts);
    expect(result.playerStatuses.block).toBe(3);
    expect(texts[0]?.stat).toBe("block");
  });
});

describe("applyStunStripArmorTalent", () => {
  it("zeros enemy armor when active", () => {
    const state = createTestBattleState({
      talentEffects: { ...defaultTalentEffects, stunStripArmor: true },
      enemyMitigation: { ...createTestBattleState().enemyMitigation, armor: 5 },
    });
    const result = applyStunStripArmorTalent(state);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("no-ops when armor already 0", () => {
    const state = createTestBattleState({
      talentEffects: { ...defaultTalentEffects, stunStripArmor: true },
    });
    const result = applyStunStripArmorTalent(state);
    expect(result.enemyMitigation.armor).toBe(0);
  });
});

describe("applyFreezeStripArmorTalent", () => {
  it("zeros enemy armor when active", () => {
    const state = createTestBattleState({
      talentEffects: { ...defaultTalentEffects, freezeStripArmor: true },
      enemyMitigation: { ...createTestBattleState().enemyMitigation, armor: 8 },
    });
    const result = applyFreezeStripArmorTalent(state);
    expect(result.enemyMitigation.armor).toBe(0);
  });
});

describe("applyStunManaTalent", () => {
  it("restores mana and emits combat text", () => {
    const state = createTestBattleState({
      mana: 1,
      talentEffects: { ...defaultTalentEffects, manaOnStun: 2 },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyStunManaTalent(state, texts);
    expect(result.mana).toBe(3);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "mana", amount: 2 }]);
  });

  it("no-ops when manaOnStun is 0", () => {
    const state = createTestBattleState({ mana: 2 });
    const result = applyStunManaTalent(state);
    expect(result.mana).toBe(2);
  });
});
