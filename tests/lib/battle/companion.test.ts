import { describe, expect, it } from "vitest";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { companionLibrary } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";

function makeTexts(): CombatTextEvent[] {
  return [];
}

describe("processCompanionTurnStart", () => {
  it("returns state unchanged when no active companion", () => {
    const state = createTestBattleState({ activeCompanion: null });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result).toBe(state);
    expect(texts).toEqual([]);
  });

  it("returns state unchanged when enemy health is 0", () => {
    const state = createTestBattleState({
      enemyHealth: 0,
      activeCompanion: companionLibrary.wolf,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result).toBe(state);
  });

  it("Wolf companion deals bleed damage and applies bleed status", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary.wolf,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    // Wolf deals 1 physical damage → health 29. Bleed status: 1 * 2 = 2.
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.bleed).toBe(2);
  });

  it("Lizard Scout companion deals poison damage", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary["lizard-scout"],
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.poison).toBe(1);
  });

  it("Imp companion deals burn damage", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary.imp,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.burn).toBe(1);
  });

  it("Frost Whelp companion deals freeze damage", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary["frost-whelp"],
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.freeze).toBe(1);
  });

  it("Bear companion deals stun damage and applies stun", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary.bear,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.stun).toBe(1);
  });

  it("Panther companion deals bleed damage like Wolf", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary.panther,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    // Same as Wolf: 1 physical damage, bleed * 2 = 2.
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.bleed).toBe(2);
  });

  it("Phoenix companion deals burn damage", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary.phoenix,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.burn).toBe(1);
  });

  it("companionDamageBuff adds to base damage", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary.wolf,
      companionDamageBuff: 2,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    // Base 1 + buff 2 = 3 damage, bleed status: 3 * 2 = 6.
    expect(result.enemyHealth).toBe(27);
    expect(result.enemyStatuses.bleed).toBe(6);
  });

  it("companionDamage talent adds to base damage", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary.imp,
      talentEffects: {
        ...createTestBattleState().talentEffects,
        companionDamage: 3,
      },
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.burn).toBe(4);
  });

  it("companion bond level adds to base damage", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary["lizard-scout"],
      talentEffects: {
        ...createTestBattleState().talentEffects,
        companionBondLevels: {
          ...createTestBattleState().talentEffects.companionBondLevels,
          "lizard-scout": 2,
        },
      },
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.poison).toBe(3);
  });

  it("all damage bonuses stack together", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary.wolf,
      companionDamageBuff: 1,
      talentEffects: {
        ...createTestBattleState().talentEffects,
        companionDamage: 2,
        companionBondLevels: {
          ...createTestBattleState().talentEffects.companionBondLevels,
          wolf: 3,
        },
      },
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.bleed).toBe(14);
  });

  it("processCompanionTurnStart produces combat texts for damage", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary.wolf,
    });
    const texts = makeTexts();
    processCompanionTurnStart(state, texts);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.target === "enemy" && t.kind === "damage")).toBe(true);
  });

  it("retains the goldOnFirstPoisonThisCombat flag when Lizard Scout companion applies poison", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary["lizard-scout"],
      talentEffects: {
        ...createTestBattleState().talentEffects,
        goldOnFirstPoison: 5,
      },
      flags: {
        ...createTestBattleState().flags,
        goldOnFirstPoisonThisCombat: false,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.gold).toBe(state.gold + 5);
    expect(result.flags.goldOnFirstPoisonThisCombat).toBe(true);
  });

  it("does not consume or benefit from firstBurnCardDoubled/firstBurnBoonDoubled when Imp companion deals burn damage", () => {
    const state = createTestBattleState({
      activeCompanion: companionLibrary.imp,
      talentEffects: {
        ...createTestBattleState().talentEffects,
        firstBurnCardDoubled: true,
      },
      trinketEffects: {
        ...createTestBattleState().trinketEffects,
        firstBurnDoubled: true,
      },
      flags: {
        ...createTestBattleState().flags,
        firstBurnCardDoubledUsed: false,
        firstBurnTrinketDoubledUsed: false,
      },
      enemyHealth: 30,
    });
    const result = processCompanionTurnStart(state, makeTexts());
    // Imp deals 1 burn damage. Since player card-play doubling flags are active
    // but disabled for companion, damage should be exactly 1, not 2 or 4.
    expect(result.enemyHealth).toBe(29);
    // Doubling flags should remain unconsumed (false)
    expect(result.flags.firstBurnCardDoubledUsed).toBe(false);
    expect(result.flags.firstBurnTrinketDoubledUsed).toBe(false);
  });
});
