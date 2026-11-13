import { describe, expect, it, vi } from "vitest";
import { companionLibrary, getCompanionDescriptionLines } from "@/lib/game-data";
import type { CompanionId } from "@/lib/game-data";
import { getBattleCompanionDescriptionLines } from "@/lib/battle/card-damage-inspection";
import {
  getRunCompanionDescriptionLines,
  type RunCompanionInspectionState,
} from "@/lib/battle/run-companion-inspection";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { battleSnapshot } from "@/lib/battle/battle-snapshot";
import { createRunRngState, createRunStateRng } from "@/lib/rng";
import { regressionBattle as battle, type BattleStatePatch } from "../../fixtures/battle";

function bonds(id: CompanionId) {
  return { ...battle().talentEffects.companionBondLevels, [id]: 1 };
}

function stateFor(id: CompanionId, patch: BattleStatePatch = {}) {
  return battle({
    enemyHealth: 1000,
    enemyMaxHealth: 1000,
    activeCompanion: companionLibrary[id],
    rng: () => 0.99,
    ...patch,
  });
}

describe("known Companion descriptions", () => {
  function actor(patch: BattleStatePatch = {}): RunCompanionInspectionState {
    const state = stateFor("panther", patch);
    return {
      talentEffects: state.talentEffects,
      gearEffects: state.gearEffects,
      trinketEffects: state.trinketEffects,
      playerHealth: state.playerHealth,
      playerMaxHealth: state.playerMaxHealth,
    };
  }

  it("shows standing shop bonuses without inventing an unbled enemy or consuming any RNG", () => {
    const known = actor({
      talentEffects: {
        companionBondLevels: bonds("panther"),
        bleedUnwoundedBonusPercent: 25,
        companionVsFrozenBonus: 10,
        companionDoubledVsLowHealth: true,
      },
      gearEffects: { flatBleedDamage: 6, companionDamageBonusVsBleeding: 7 },
    });
    const before = structuredClone(known);
    expect(getRunCompanionDescriptionLines(companionLibrary.panther, known)).toEqual([
      "Deals 8 Bleed damage each turn",
    ]);
    expect(known).toEqual(before);
    expect(known).not.toHaveProperty("enemyStatuses");
  });

  it("preserves the real random type range instead of selecting a shop outcome", () => {
    const known = actor({
      talentEffects: { companionBondLevels: bonds("wolf") },
      gearEffects: { flatBleedDamage: 6, flatPhysicalDamage: 2 },
    });
    expect(getRunCompanionDescriptionLines(companionLibrary.wolf, known)).toEqual([
      "Deals 4–8 Bleed or Physical damage each turn",
    ]);
  });

  it("uses canonical known utility grants and keeps Bond chance wording", () => {
    const known = actor({
      playerHealth: 8,
      playerMaxHealth: 40,
      talentEffects: {
        companionBondLevels: { ...bonds("pixie"), "mana-moth": 1, "shield-scarab": 1, "golden-retriever": 1 },
        homesteadHealing: 1,
        healMultiplier: 1.5,
      },
      gearEffects: {
        healingBonusBelowHalfHealth: 2,
        flatBlockGained: 2,
        blockGainBonusBelowHalfHealth: 1,
        goldGainPercent: 50,
      },
    });
    expect(getRunCompanionDescriptionLines(companionLibrary.pixie, known)).toEqual(["Restores 8 Health each turn"]);
    expect(getRunCompanionDescriptionLines(companionLibrary["shield-scarab"], known)).toEqual([
      "Gains 6 Block each turn",
    ]);
    expect(getRunCompanionDescriptionLines(companionLibrary["golden-retriever"], known)).toEqual([
      "Gain 3 Gold each turn",
    ]);
    expect(getRunCompanionDescriptionLines(companionLibrary["mana-moth"], known)).toEqual([
      "Gain 1 Mana each turn, with a 25% chance to grant 1 more, allowing overflow",
    ]);
  });

  it("includes Panther Bond, typed Gear and First Blood once, and removes the conditional bonus when Bleeding", () => {
    const state = stateFor("panther", {
      talentEffects: { companionBondLevels: bonds("panther"), bleedUnwoundedBonusPercent: 25 },
      gearEffects: { flatBleedDamage: 6 },
    });
    expect(getBattleCompanionDescriptionLines(companionLibrary.panther, state)).toEqual([
      "Deals 10 Bleed damage each turn",
    ]);
    const texts: Parameters<typeof processCompanionTurnStart>[1] = [];
    const after = processCompanionTurnStart(state, texts);
    expect(texts).toContainEqual(expect.objectContaining({ target: "enemy", stat: "bleed", amount: 10 }));
    expect(getBattleCompanionDescriptionLines(companionLibrary.panther, after)).toEqual([
      "Deals 8 Bleed damage each turn",
    ]);
  });

  it.each([
    ["skeleton", "Physical", 7, { playerStatuses: { forge: 3 }, gearEffects: { flatPhysicalDamage: 2 } }],
    ["bear", "Stun", 9, { playerStatuses: { forge: 3 }, gearEffects: { flatStunDamage: 4 } }],
    [
      "phoenix",
      "Burn",
      7,
      {
        playerStatuses: { forge: 4 },
        talentEffects: { homesteadForgeBurnPercent: 50 },
        gearEffects: { flatBurnDamage: 3 },
      },
    ],
    ["frost-whelp", "Freeze", 4, { gearEffects: { flatFreezeDamage: 2 } }],
    ["lizard-scout", "Poison", 5, { gearEffects: { flatPoisonDamage: 3 } }],
  ] as const)("matches known %s damage without changing execution", (id, type, amount, patch) => {
    const state = stateFor(id, {
      ...patch,
      talentEffects: { ...("talentEffects" in patch ? patch.talentEffects : {}), companionBondLevels: bonds(id) },
    });
    expect(getBattleCompanionDescriptionLines(companionLibrary[id], state)[0]).toBe(
      `Deals ${amount} ${type} damage each turn`,
    );
    const texts: Parameters<typeof processCompanionTurnStart>[1] = [];
    processCompanionTurnStart(state, texts);
    expect(texts).toContainEqual(expect.objectContaining({ target: "enemy", stat: type.toLowerCase(), amount }));
  });

  it("keeps random damage types as a known range rather than choosing a roll", () => {
    const state = stateFor("wolf", {
      playerStatuses: { forge: 3 },
      talentEffects: { companionBondLevels: bonds("wolf"), bleedUnwoundedBonusPercent: 25 },
      gearEffects: { flatPhysicalDamage: 2, flatBleedDamage: 6 },
    });
    expect(getBattleCompanionDescriptionLines(companionLibrary.wolf, state)[0]).toBe(
      "Deals 7–10 Bleed or Physical damage each turn",
    );
  });

  it("preserves prepared card bonuses and consumes no live RNG or resources", () => {
    const rng = vi.fn(() => 0.99);
    const state = stateFor("skeleton", {
      rng,
      flags: {
        nextHitPoison: true,
        nextHitPhysicalBonus: 20,
        nextHitCrit: true,
        playNextCardTwice: true,
        companionNextAttackBonus: 3,
      },
      talentEffects: { companionBondLevels: bonds("skeleton") },
      gearEffects: { flatPhysicalDamage: 1 },
    });
    const before = structuredClone(battleSnapshot(state));
    expect(getBattleCompanionDescriptionLines(companionLibrary.skeleton, state)[0]).toBe(
      "Deals 6 Physical damage each turn",
    );
    expect(rng).not.toHaveBeenCalled();
    expect(battleSnapshot(state)).toEqual(before);
    const texts: Parameters<typeof processCompanionTurnStart>[1] = [];
    const after = processCompanionTurnStart(state, texts);
    expect(after.flags.nextHitPoison).toBe(true);
    expect(after.flags.nextHitCrit).toBe(true);
    expect(after.flags.playNextCardTwice).toBe(true);
    expect(after.flags.companionNextAttackBonus).toBe(0);
    expect(texts).toContainEqual(expect.objectContaining({ stat: "physical", amount: 6 }));
  });

  it("shows offensive power before target Block and Armor", () => {
    const state = stateFor("skeleton", {
      enemyMitigation: { block: 100, armor: 100 },
      gearEffects: { flatPhysicalDamage: 4 },
    });
    expect(getBattleCompanionDescriptionLines(companionLibrary.skeleton, state)[0]).toBe(
      "Deals 5 Physical damage each turn",
    );
    expect(processCompanionTurnStart(state, []).enemyHealth).toBe(state.enemyHealth);
  });

  it("includes Kingbreaker's known offensive Armor conversion", () => {
    const state = stateFor("bear", {
      enemyMitigation: { armor: 4 },
      gearEffects: { armorIncreasesStun: 1 },
      playerStatuses: { forge: 3 },
      talentEffects: { companionBondLevels: bonds("bear") },
    });
    expect(getBattleCompanionDescriptionLines(companionLibrary.bear, state)[0]).toBe("Deals 9 Stun damage each turn");
  });

  it("keeps healing grants before the cap and updates Scarab's known Block", () => {
    const pixie = stateFor("pixie", {
      playerHealth: 39,
      playerMaxHealth: 40,
      talentEffects: { companionBondLevels: bonds("pixie"), healMultiplier: 1.5 },
    });
    expect(getBattleCompanionDescriptionLines(companionLibrary.pixie, pixie)[0]).toBe("Restores 3 Health each turn");
    expect(processCompanionTurnStart(pixie, []).playerHealth).toBe(40);
    const scarab = stateFor("shield-scarab", {
      playerStatuses: { forge: 4 },
      talentEffects: { companionBondLevels: bonds("shield-scarab"), forgeBlockPercent: 25 },
      gearEffects: { flatBlockGained: 2 },
    });
    expect(getBattleCompanionDescriptionLines(companionLibrary["shield-scarab"], scarab)[0]).toBe(
      "Gains 6 Block each turn",
    );
    expect(processCompanionTurnStart(scarab, []).playerStatuses.block).toBe(6);
  });

  it.each(["library-owl", "mana-moth", "will-o-wisp", "golden-retriever"] as const)(
    "preserves %s utility and Bond wording without doubling it",
    (id) => {
      const state = stateFor(id, { talentEffects: { companionBondLevels: bonds(id) } });
      expect(getBattleCompanionDescriptionLines(companionLibrary[id], state)).toEqual(
        getCompanionDescriptionLines(companionLibrary[id], 1),
      );
    },
  );

  it("keeps collection descriptions authored", () => {
    expect(getCompanionDescriptionLines(companionLibrary.panther)).toEqual(["Deals 1 Bleed damage each turn"]);
  });

  it("updates low-Health and Bleeding Companion bonuses using their exact current conditions", () => {
    const state = stateFor("panther", {
      enemyHealth: 30,
      enemyMaxHealth: 100,
      talentEffects: { companionBondLevels: bonds("panther"), companionDoubledVsLowHealth: true },
      gearEffects: { flatBleedDamage: 6, companionDamageBonusVsBleeding: 3 },
    });
    expect(getBattleCompanionDescriptionLines(companionLibrary.panther, state)[0]).toBe(
      "Deals 8 Bleed damage each turn",
    );
    expect(getBattleCompanionDescriptionLines(companionLibrary.panther, { ...state, enemyHealth: 29 })[0]).toBe(
      "Deals 10 Bleed damage each turn",
    );
    expect(
      getBattleCompanionDescriptionLines(companionLibrary.panther, {
        ...state,
        enemyStatuses: { ...state.enemyStatuses, bleed: 1 },
      })[0],
    ).toBe("Deals 11 Bleed damage each turn");
  });

  it("leaves seeded gameplay, action order and feedback identical after repeated inspection", () => {
    const make = () => {
      const rng = createRunRngState(43);
      return {
        rng,
        state: stateFor("panther", {
          rng: createRunStateRng(rng, "world"),
          talentEffects: { companionBondLevels: bonds("panther"), bleedUnwoundedBonusPercent: 25 },
          gearEffects: { flatBleedDamage: 6, burnBleedMirrorAndLeech: 1 },
        }),
      };
    };
    const baseline = make(),
      inspected = make();
    const before = structuredClone(inspected.rng);
    for (let i = 0; i < 3; i++) getBattleCompanionDescriptionLines(companionLibrary.panther, inspected.state);
    expect(inspected.rng).toEqual(before);
    const a: Parameters<typeof processCompanionTurnStart>[1] = [],
      b: Parameters<typeof processCompanionTurnStart>[1] = [];
    expect(battleSnapshot(processCompanionTurnStart(inspected.state, a))).toEqual(
      battleSnapshot(processCompanionTurnStart(baseline.state, b)),
    );
    expect(a).toEqual(b);
    expect(inspected.rng).toEqual(baseline.rng);
  });
});
