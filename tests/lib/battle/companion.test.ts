import { describe, expect, it, vi } from "vitest";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { getBattleCompanionDamageModifiers } from "@/lib/battle/companion-scaling";
import { companionLibrary, type CompanionId } from "@/lib/game-data";
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

  it("does not spend or benefit from the first-Burn Boon when Phoenix attacks", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      trinketEffects: {
        firstBurnDoubled: true,
      },
      flags: {
        firstBurnTrinketDoubledUsed: false,
      },
      enemyHealth: 30,
    });
    const result = processCompanionTurnStart(state, makeTexts());

    expect(result.enemyHealth).toBe(29);

    expect(result.flags.firstBurnTrinketDoubledUsed).toBe(false);
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

  it("Companion attacks preserve the hero's prepared Critical, Leech, and Opening", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.wolf,
      flags: { nextHitCrit: true, nextHitLeech: true, nextHitPhysicalBonus: 4 },
      playerHealth: 10,
      rng: () => 0.99,
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyHealth).toBe(29);
    expect(result.playerHealth).toBe(state.playerHealth);
    expect(result.flags).toMatchObject({ nextHitCrit: true, nextHitLeech: true, nextHitPhysicalBonus: 4 });
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

  it("Takedown stuns when the companion deals damage and the roll succeeds", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      talentEffects: {
        companionStunChance: 100,
      },
    });
    const result = processCompanionTurnStart(state, makeTexts());
    expect(result.enemyStatuses.stun).toBe(1);
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
});

it.each([4, 5])("Mana Moth extra Mana grants extra Mana after refill or Wellspring at %i Mana", (mana) => {
  const state = patchBattleState({ mana, maxMana: 4, activeCompanion: companionLibrary["mana-moth"] });
  const result = processCompanionTurnStart(state, []);
  expect(result.mana).toBe(mana + 1);
  expect(result.maxMana).toBe(4);
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

it.each([
  [30, 100, 1],
  [10, 32, 1],
  [9, 32, 2],
])(
  "Predator's Instinct threshold deals %i / %i Health enemies the correctly scaled damage",
  (enemyHealth, enemyMaxHealth, damage) => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      enemyHealth,
      enemyMaxHealth,
      talentEffects: { companionDoubledVsLowHealth: true },
    });
    expect(processCompanionTurnStart(state, []).enemyHealth).toBe(enemyHealth - damage);
  },
);

it("Companion scaling integration applies every damage bonus once and preserves the prepared next attack", () => {
  const state = patchBattleState({
    activeCompanion: companionLibrary.phoenix,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    maxMana: 4,
    enemyCC: { freezeSkipTurns: 1 },
    flags: { nextHitCrit: true },
    talentEffects: { companionDamage: 2, companionVsFrozenBonus: 4 },
    gearEffects: { companionDamageBonus: 3 },
    trinketEffects: { companionDamageBonus: 2 },
  });
  expect(getBattleCompanionDamageModifiers(state)).toEqual({
    damageBonus: 11,
    damageMultiplier: 1,
  });
  const texts = makeTexts();
  const result = processCompanionTurnStart(state, texts);
  expect(result.enemyHealth).toBe(88);
  expect(result.enemyStatuses.burn).toBe(12);
  expect(result.flags.nextHitCrit).toBe(true);
  expect(texts).toContainEqual(expect.objectContaining({ target: "enemy", kind: "damage", stat: "burn", amount: 12 }));
  expect(state.enemyStatuses.burn).toBe(0);
});
