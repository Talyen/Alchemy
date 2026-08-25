import { describe, expect, it } from "vitest";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { defaultGearEffects } from "@/lib/gear/gear-effect-manifest";
import { companionLibrary } from "@/lib/game-data";
import { makeCombatTexts as makeTexts, makeTestBattleState } from "../../fixtures/battle";

describe("processCompanionTurnStart", () => {
  it("returns state unchanged when no active companion", () => {
    const state = makeTestBattleState({ activeCompanion: null });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result).toBe(state);
    expect(texts).toEqual([]);
  });

  it("returns state unchanged when enemy health is 0", () => {
    const state = makeTestBattleState({
      enemyHealth: 0,
      activeCompanion: companionLibrary.wolf,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result).toBe(state);
  });

  it("Wolf companion deals bleed damage and applies bleed status", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.wolf,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    // Wolf deals 1 physical damage → health 29. Bleed status: 1 * 2 = 2.
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.bleed).toBe(2);
  });

  it("Lizard Scout companion deals poison damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary["lizard-scout"],
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.poison).toBe(1);
  });

  it("Frost Whelp companion deals freeze damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary["frost-whelp"],
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.freeze).toBe(1);
  });

  it("Bear companion deals stun damage and applies stun", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.bear,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.stun).toBe(1);
  });

  it("Panther companion deals bleed damage like Wolf", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.panther,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    // Same as Wolf: 1 physical damage, bleed * 2 = 2.
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.bleed).toBe(2);
  });

  it("Phoenix companion deals burn damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.burn).toBe(1);
  });

  it("companionDamageBuff adds to base damage", () => {
    const state = makeTestBattleState({
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
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        companionDamage: 3,
      },
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.burn).toBe(4);
  });

  it("companion bond level adds to base damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary["lizard-scout"],
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        companionBondLevels: {
          ...makeTestBattleState().talentEffects.companionBondLevels,
          "lizard-scout": 2,
        },
      },
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.poison).toBe(3);
  });

  it("all damage bonuses stack together", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.wolf,
      companionDamageBuff: 1,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        companionDamage: 2,
        companionBondLevels: {
          ...makeTestBattleState().talentEffects.companionBondLevels,
          wolf: 3,
        },
      },
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.bleed).toBe(14);
  });

  it("processCompanionTurnStart produces combat texts for damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.wolf,
    });
    const texts = makeTexts();
    processCompanionTurnStart(state, texts);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.target === "enemy" && t.kind === "damage")).toBe(true);
  });

  it("retains the goldOnFirstPoisonThisCombat flag when Lizard Scout companion applies poison", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary["lizard-scout"],
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        goldOnFirstPoison: 5,
      },
      flags: {
        ...makeTestBattleState().flags,
        goldOnFirstPoisonThisCombat: false,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.gold).toBe(state.gold + 5);
    expect(result.flags.goldOnFirstPoisonThisCombat).toBe(true);
  });

  it("does not consume or benefit from firstBurnCardDoubled/firstBurnBoonDoubled when Phoenix companion deals burn damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        firstBurnCardBonusMultiplier: 1.5,
      },
      trinketEffects: {
        ...makeTestBattleState().trinketEffects,
        firstBurnDoubled: true,
      },
      flags: {
        ...makeTestBattleState().flags,
        firstBurnCardDoubledUsed: false,
        firstBurnTrinketDoubledUsed: false,
      },
      enemyHealth: 30,
    });
    const result = processCompanionTurnStart(state, makeTexts());
    // Phoenix deals 1 burn damage. Since player card-play doubling flags are active
    // but disabled for companion, damage should be exactly 1, not 2 or 4.
    expect(result.enemyHealth).toBe(29);
    // Doubling flags should remain unconsumed (false)
    expect(result.flags.firstBurnCardDoubledUsed).toBe(false);
    expect(result.flags.firstBurnTrinketDoubledUsed).toBe(false);
  });

  it("companionBleedDamageBonus adds to bleed-type companion (Panther) damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.panther,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        companionBleedDamageBonus: 3,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    // Panther base 1 bleed + bleed bonus 3 = 4, bleed status: 4 × 2 = 8.
    expect(result.enemyStatuses.bleed).toBe(8);
  });

  it("companionVsFrozenBonus adds when enemy has freeze skip turns", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0, cooldown: 0 },
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        companionVsFrozenBonus: 3,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    // Phoenix 1 burn + frozen bonus 3 = 4 damage → enemy 26.
    expect(result.enemyHealth).toBe(26);
  });

  it("companionDoubledVsLowHealth doubles damage when enemy ≤ 30% HP", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      enemyHealth: 8,
      enemyMaxHealth: 30,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        companionDoubledVsLowHealth: true,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    // Phoenix base 1 burn × 2 low-health = 2 → enemy 6.
    expect(result.enemyHealth).toBe(6);
  });

  it("companionDamagePerManaCrystal scales damage with max mana", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      maxMana: 6,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        companionDamagePerManaCrystal: 200,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    // Phoenix base 1 + (6 × 200 / 2) = 1 + 600 = 601, burn status: 601.
    expect(result.enemyStatuses.burn).toBe(601);
  });

  it("companionDamageBonus gear adds flat damage to companion", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      gearEffects: { ...defaultGearEffects, companionDamageBonus: 5 },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    // Phoenix 1 + 5 = 6 damage → enemy 24.
    expect(result.enemyHealth).toBe(24);
  });

  it("gearEffects.companionDamageBonus adds to companion damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      gearEffects: { ...defaultGearEffects, companionDamageBonus: 5 },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    // Phoenix 1 + 5 = 6 damage → enemy 24.
    expect(result.enemyHealth).toBe(24);
  });

  it("healOnCompanionAttack heals player when companion deals damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      playerHealth: 10,
      playerMaxHealth: 30,
      gearEffects: {
        ...makeTestBattleState().gearEffects,
        healOnCompanionAttack: 4,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.playerHealth).toBe(14);
  });

  it("healOnCompanionAttack combat text uses actual health gained near max HP", () => {
    const texts = makeTexts();
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      playerHealth: 29,
      playerMaxHealth: 30,
      gearEffects: {
        ...makeTestBattleState().gearEffects,
        healOnCompanionAttack: 4,
      },
    });
    const result = processCompanionTurnStart(state, texts);
    expect(result.playerHealth).toBe(30);
    expect(texts.find((t) => t.kind === "heal")).toEqual({
      target: "player",
      kind: "heal",
      stat: "health",
      amount: 1,
    });
  });

  it("healOnCompanionAttack no-ops when companion has no damage effect", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary["shield-scarab"],
      playerHealth: 10,
      playerMaxHealth: 30,
      gearEffects: {
        ...makeTestBattleState().gearEffects,
        healOnCompanionAttack: 4,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    // Shield Scarab has no damage effects, so no heal.
    expect(result.playerHealth).toBe(10);
  });

  it("companionLeechChance triggers leech heal on damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        companionLeechChance: 100,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    // Phoenix deals 1 burn. Leech heal = leech(1) = at least 1 healing.
    expect(result.playerHealth).toBeGreaterThan(10);
    expect(result.enemyHealth).toBe(29);
  });

  it("companionLeechChance no-ops on failed roll", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.wolf,
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        companionLeechChance: 50,
      },
      rng: () => 0.99,
    });
    const result = processCompanionTurnStart(state, makeTexts());
    // Roll fails, no leech.
    expect(result.playerHealth).toBe(10);
  });

  it("applies both healOnCompanionAttack gear and companionLeechChance talent when both are active", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      playerHealth: 10,
      playerMaxHealth: 30,
      gearEffects: {
        ...makeTestBattleState().gearEffects,
        healOnCompanionAttack: 4,
      },
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        companionLeechChance: 100,
      },
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    // Gear heal (4) and leech heal (1) both apply -> health is 15. Combat text merges to amount: 5.
    expect(result.playerHealth).toBe(15);
    const healText = texts.find((t) => t.kind === "heal") as { amount?: number } | undefined;
    expect(healText).toBeDefined();
    expect(healText?.amount).toBe(5);
  });

  it("does not crit or consume nextHitCrit on companion damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.wolf,
      flags: { ...makeTestBattleState().flags, nextHitCrit: true },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyHealth).toBe(29);
    expect(result.flags.nextHitCrit).toBe(true);
  });

  it("does not consume Opening on companion damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.wolf,
      flags: { ...makeTestBattleState().flags, nextHitPhysicalBonus: 4 },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyHealth).toBe(29);
    expect(result.flags.nextHitPhysicalBonus).toBe(4);
  });

  it("healOnCompanionAttack heals Fox when the damage branch resolves", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.fox,
      playerHealth: 10,
      playerMaxHealth: 30,
      rng: () => 0.1,
      gearEffects: {
        ...makeTestBattleState().gearEffects,
        healOnCompanionAttack: 4,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyHealth).toBe(29);
    expect(result.playerHealth).toBe(14);
  });

  it("healOnCompanionAttack no-ops when Fox takes the gold branch", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.fox,
      playerHealth: 10,
      playerMaxHealth: 30,
      gold: 0,
      rng: () => 0.9,
      gearEffects: {
        ...makeTestBattleState().gearEffects,
        healOnCompanionAttack: 4,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyHealth).toBe(30);
    expect(result.gold).toBe(1);
    expect(result.playerHealth).toBe(10);
  });

  it("Watchdog grants Block when the companion deals damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.wolf,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        blockOnCompanionDamage: 2,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.playerStatuses.block).toBe(2);
  });

  it("Watchdog no-ops when the companion deals no damage", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.pixie,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        blockOnCompanionDamage: 2,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.playerStatuses.block).toBe(0);
  });

  it("Takedown stuns when the companion deals damage and the roll succeeds", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        companionStunChance: 100,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyStatuses.stun).toBeGreaterThanOrEqual(1);
  });

  it("Takedown does not stun when the roll fails", () => {
    const state = makeTestBattleState({
      activeCompanion: companionLibrary.phoenix,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        companionStunChance: 50,
      },
      rng: () => 0.99,
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyStatuses.stun).toBe(0);
  });

  it("handles missing or undefined companionBondLevels gracefully without NaN", () => {
    const base = makeTestBattleState();
    const state = {
      ...base,
      activeCompanion: companionLibrary.wolf,
      talentEffects: {
        ...base.talentEffects,
        companionBondLevels: {} as any,
      },
    };
    const result = processCompanionTurnStart(state, makeTexts());
    expect(Number.isNaN(result.enemyHealth)).toBe(false);
    expect(result.enemyHealth).toBe(29);
  });
});
