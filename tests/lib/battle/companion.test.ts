import { describe, expect, it, vi } from "vitest";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { getBattleCompanionDamageModifiers } from "@/lib/battle/companion-scaling";
import { companionLibrary, getCompanionDescriptionLines, type CompanionId } from "@/lib/game-data";
import { makeCombatTexts as makeTexts, makeTestCard, patchBattleState } from "../../fixtures/battle";

function wolfBleedRng() {
  let first = true;
  return () => {
    if (first) {
      first = false;
      return 0;
    }
    return 0.99;
  };
}

describe("processCompanionTurnStart", () => {
  it("returns state unchanged when no active companion", () => {
    const state = patchBattleState({ activeCompanion: null });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result).toBe(state);
    expect(texts).toEqual([]);
  });

  it("returns state unchanged when enemy health is 0", () => {
    const state = patchBattleState({
      enemyHealth: 0,
      activeCompanion: companionLibrary.wolf,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result).toBe(state);
  });

  it("Wolf companion deals Bleed damage and does not grant Block", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.wolf,
      rng: wolfBleedRng(),
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);

    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.bleed).toBe(1);
    expect(result.playerStatuses.block).toBe(0);
  });

  it("Wolf companion can deal Physical damage", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.wolf,
      rng: () => 0.99,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);

    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.bleed).toBe(0);
    expect(result.playerStatuses.block).toBe(0);
  });

  it("retains the goldOnFirstPoisonThisCombat flag when Lizard Scout companion applies poison", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary["lizard-scout"],
      talentEffects: {
        goldOnFirstPoison: 5,
      },
      flags: {
        goldOnFirstPoisonThisCombat: false,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.gold).toBe(state.gold + 5);
    expect(result.flags.goldOnFirstPoisonThisCombat).toBe(true);
  });

  it("does not consume or benefit from firstBurnCardDoubled/firstBurnBoonDoubled when Phoenix companion deals burn damage", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      talentEffects: {
        firstBurnCardBonusMultiplier: 1.5,
      },
      trinketEffects: {
        firstBurnDoubled: true,
      },
      flags: {
        firstBurnCardDoubledUsed: false,
        firstBurnTrinketDoubledUsed: false,
      },
      enemyHealth: 30,
    });
    const result = processCompanionTurnStart(state, makeTexts());

    expect(result.enemyHealth).toBe(29);

    expect(result.flags.firstBurnCardDoubledUsed).toBe(false);
    expect(result.flags.firstBurnTrinketDoubledUsed).toBe(false);
  });

  it("companionBleedDamageBonus adds to bleed-type companion (Panther) damage", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.panther,
      talentEffects: {
        companionBleedDamageBonus: 3,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());

    expect(result.enemyStatuses.bleed).toBe(4);
  });

  it.each([
    ["wolf", 0, 4],
    ["wolf", 0.99, 1],
    ["fox", 0, 1],
    ["fox", 0.99, 4],
  ] as const)("applies the Bleed bonus only to the selected %s damage type at roll %s", (id, roll, damage) => {
    let first = true;
    const state = patchBattleState({
      activeCompanion: companionLibrary[id],
      talentEffects: { companionBleedDamageBonus: 3 },
      rng: () => {
        if (!first) return 0.99;
        first = false;
        return roll;
      },
    });
    expect(processCompanionTurnStart(state, []).enemyHealth).toBe(state.enemyHealth - damage);
    expect(getCompanionDescriptionLines(companionLibrary[id], 0, getBattleCompanionDamageModifiers(state))).toEqual([
      id === "wolf"
        ? "Deals 4 Bleed damage or Deals 1 Physical damage each turn"
        : "Deals 1 Stun damage or Deals 4 Bleed damage each turn",
    ]);
  });

  it("companionVsFrozenBonus adds when enemy has freeze skip turns", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0, cooldown: 0 },
      talentEffects: {
        companionVsFrozenBonus: 3,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());

    expect(result.enemyHealth).toBe(26);
  });

  it("companionDoubledVsLowHealth doubles damage when enemy is below 30% HP", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      enemyHealth: 8,
      enemyMaxHealth: 30,
      talentEffects: {
        companionDoubledVsLowHealth: true,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());

    expect(result.enemyHealth).toBe(6);
  });

  it("companionDamagePerManaCrystal scales damage with max mana", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      maxMana: 6,
      talentEffects: {
        companionDamagePerManaCrystal: 200,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());

    expect(result.enemyStatuses.burn).toBe(601);
  });

  it("healOnCompanionAttack heals player when companion deals damage", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      playerHealth: 10,
      playerMaxHealth: 30,
      gearEffects: {
        healOnCompanionAttack: 4,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.playerHealth).toBe(14);
  });

  it("healOnCompanionAttack does not heal above half Health", () => {
    const texts = makeTexts();
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      playerHealth: 29,
      playerMaxHealth: 30,
      gearEffects: {
        healOnCompanionAttack: 4,
      },
    });
    const result = processCompanionTurnStart(state, texts);
    expect(result.playerHealth).toBe(29);
    expect(texts.find((t) => t.kind === "heal")).toBeUndefined();
  });

  it("healOnCompanionAttack no-ops when companion has no damage effect", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary["shield-scarab"],
      playerHealth: 10,
      playerMaxHealth: 30,
      gearEffects: {
        healOnCompanionAttack: 4,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());

    expect(result.playerHealth).toBe(10);
  });

  it("companionLeechChance triggers leech heal on damage", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: {
        companionLeechChance: 100,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());

    expect(result.playerHealth).toBeGreaterThan(10);
    expect(result.enemyHealth).toBe(29);
  });

  it("companionLeechChance no-ops on failed roll", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.wolf,
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: {
        companionLeechChance: 50,
      },
      rng: () => 0.99,
    });
    const result = processCompanionTurnStart(state, makeTexts());

    expect(result.playerHealth).toBe(10);
  });

  it("applies both healOnCompanionAttack gear and companionLeechChance talent when both are active", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      playerHealth: 10,
      playerMaxHealth: 30,
      gearEffects: {
        healOnCompanionAttack: 4,
      },
      talentEffects: {
        companionLeechChance: 100,
      },
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);

    expect(result.playerHealth).toBe(15);
    const healText = texts.find((t) => t.kind === "heal") as { amount?: number } | undefined;
    expect(healText).toBeDefined();
    expect(healText?.amount).toBe(5);
  });

  it("does not crit or consume nextHitCrit on companion damage", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.wolf,
      flags: { nextHitCrit: true },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyHealth).toBe(29);
    expect(result.flags.nextHitCrit).toBe(true);
  });

  it("does not consume nextHitLeech on companion damage", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.wolf,
      flags: { nextHitLeech: true },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyHealth).toBe(29);
    expect(result.flags.nextHitLeech).toBe(true);
  });

  it("does not consume Opening on companion damage", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.wolf,
      flags: { nextHitPhysicalBonus: 4 },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyHealth).toBe(29);
    expect(result.flags.nextHitPhysicalBonus).toBe(4);
  });

  it("healOnCompanionAttack heals Fox while Fox deals Stun", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.fox,
      playerHealth: 10,
      playerMaxHealth: 30,
      rng: () => 0.1,
      gearEffects: {
        healOnCompanionAttack: 4,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.stun).toBe(1);
    expect(result.gold).toBe(0);
    expect(result.playerHealth).toBe(14);
  });

  it("Fox can deal Bleed without granting Gold", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.fox,
      playerHealth: 10,
      playerMaxHealth: 30,
      gold: 0,
      rng: () => 0.9,
      gearEffects: {
        healOnCompanionAttack: 4,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.bleed).toBe(1);
    expect(result.gold).toBe(0);
    expect(result.playerHealth).toBe(14);
  });

  it("Watchdog does not react directly to Companion damage", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.wolf,
      talentEffects: {
        companionAttackOnBlockDepletedBelowHalf: true,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.playerStatuses.block).toBe(0);
  });

  it("Watchdog no-ops when the companion deals no damage", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.pixie,
      talentEffects: {
        companionAttackOnBlockDepletedBelowHalf: true,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.playerStatuses.block).toBe(0);
  });

  it("Takedown stuns when the companion deals damage and the roll succeeds", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      talentEffects: {
        companionStunChance: 100,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyStatuses.stun).toBeGreaterThanOrEqual(1);
  });

  it("Takedown does not stun when the roll fails", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      talentEffects: {
        companionStunChance: 50,
      },
      rng: () => 0.99,
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyStatuses.stun).toBe(0);
  });

  it("handles missing or undefined companionBondLevels gracefully without NaN", () => {
    const base = patchBattleState();
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

describe("Mana Moth extra Mana", () => {
  it.each([4, 5])("grants extra Mana after refill or Wellspring at %i Mana", (mana) => {
    const state = patchBattleState({ mana, maxMana: 4, activeCompanion: companionLibrary["mana-moth"] });
    const result = processCompanionTurnStart(state, []);
    expect(result.mana).toBe(mana + 1);
    expect(result.maxMana).toBe(4);
  });
});

describe("Companion Bond progression", () => {
  function bondedState(id: CompanionId, level: number) {
    const base = patchBattleState({ activeCompanion: companionLibrary[id] });
    return {
      ...base,
      talentEffects: {
        ...base.talentEffects,
        companionBondLevels: { ...base.talentEffects.companionBondLevels, [id]: level },
      },
    };
  }

  it.each([0, 1, 2, 3])("applies all guaranteed effects at Bond %i", (level) => {
    for (const [id, baseline, status] of [
      ["wolf", 1, "bleed"],
      ["panther", 1, "bleed"],
      ["lizard-scout", 1, "poison"],
      ["frost-whelp", 1, "freeze"],
      ["bear", 1, "stun"],
      ["phoenix", 1, "burn"],
    ] as const) {
      const state = { ...bondedState(id, level), ...(id === "wolf" ? { rng: wolfBleedRng() } : {}) };
      const result = processCompanionTurnStart(state, []);
      expect(result.enemyHealth).toBe(state.enemyHealth - baseline - level);
      expect(result.enemyStatuses[status]).toBe(baseline + level);
      expect(result.playerStatuses.block).toBe(0);
      expect(state.enemyStatuses[status]).toBe(0);
    }
    const skeleton = bondedState("skeleton", level);
    expect(processCompanionTurnStart(skeleton, []).enemyHealth).toBe(skeleton.enemyHealth - 1 - level);
    expect(processCompanionTurnStart(bondedState("shield-scarab", level), []).playerStatuses.block).toBe(2 + level);
    expect(processCompanionTurnStart(bondedState("golden-retriever", level), []).gold).toBe(2 + level);
    const pixie = { ...bondedState("pixie", level), playerHealth: 10 };
    expect(processCompanionTurnStart(pixie, []).playerHealth).toBe(11 + level);
    const wisp = { ...bondedState("will-o-wisp", level), playerHealth: 10 };
    wisp.playerStatuses = { ...wisp.playerStatuses, poison: 3 };
    const healed = processCompanionTurnStart(wisp, []);
    expect(healed.playerStatuses.poison).toBe(0);
    expect(healed.playerHealth).toBe(10 + level);
    const fox = bondedState("fox", level);
    const foxResult = processCompanionTurnStart({ ...fox, rng: () => 0.25 }, []);
    expect(foxResult.enemyHealth).toBe(fox.enemyHealth - 1 - level);
    expect(foxResult.gold).toBe(0);
    expect(foxResult.enemyStatuses.stun).toBe(1 + level);
    expect(foxResult.enemyStatuses.bleed).toBe(0);
  });

  it.each([0, 1, 2, 3])("keeps utility baselines and rolls the correct bonus at Bond %i", (level) => {
    for (const id of ["mana-moth", "library-owl"] as const) {
      for (const roll of [Math.max(0, level / 4 - 0.001), level / 4]) {
        const rng = vi.fn(() => roll);
        const state = { ...bondedState(id, level), mana: 4, maxMana: 4, rng, deck: [makeTestCard(), makeTestCard()] };
        const result = processCompanionTurnStart(state, []);
        const amount = 1 + (level > 0 && roll < level / 4 ? 1 : 0);
        expect(id === "mana-moth" ? result.mana - 4 : result.hand.length).toBe(amount);
        expect(result.maxMana).toBe(4);
        expect(rng).toHaveBeenCalledTimes(level === 0 ? 0 : 1);
      }
    }
  });
});

describe("Predator's Instinct threshold", () => {
  it.each([
    [30, 100, 1],
    [10, 32, 1],
    [9, 32, 2],
  ])("deals %i / %i Health enemies the correctly scaled damage", (enemyHealth, enemyMaxHealth, damage) => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      enemyHealth,
      enemyMaxHealth,
      talentEffects: { companionDoubledVsLowHealth: true },
    });
    expect(processCompanionTurnStart(state, []).enemyHealth).toBe(enemyHealth - damage);
  });
});

describe("Companion scaling integration", () => {
  it("applies every damage bonus once and preserves the prepared next attack", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      maxMana: 4,
      companionDamageBuff: 1,
      enemyCC: { freezeSkipTurns: 1 },
      flags: { nextHitCrit: true },
      talentEffects: { companionDamage: 2, companionVsFrozenBonus: 4, companionDamagePerManaCrystal: 1 },
      gearEffects: { companionDamageBonus: 3 },
      trinketEffects: { companionDamageBonus: 2 },
    });
    expect(getBattleCompanionDamageModifiers(state)).toEqual({
      damageBonus: 14,
      bleedDamageBonus: 0,
      damageMultiplier: 1,
    });
    const texts = makeTexts();
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyHealth).toBe(85);
    expect(result.enemyStatuses.burn).toBe(15);
    expect(result.flags.nextHitCrit).toBe(true);
    expect(texts).toContainEqual(
      expect.objectContaining({ target: "enemy", kind: "damage", stat: "burn", amount: 15 }),
    );
    expect(state.enemyStatuses.burn).toBe(0);
  });
});
