import { describe, expect, it } from "vitest";
import {
  cardById,
  companionLibrary,
  defaultCompanionBondLevels,
  enemyById,
  getCompanionDescriptionLines,
} from "@/lib/game-data";
import { getEffectiveCardDescriptionLines } from "@/lib/game-data/card-description";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { createBattleStartState } from "@/lib/battle/battle-setup";
import { getBattleCompanionDamageModifiers } from "@/lib/battle/companion-scaling";
import { applyDrawResult, drawFromState, drawKeywordCard } from "@/lib/battle/draw";
import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { battleSnapshot, type BattleState } from "@/lib/battle/types";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { makeTestCard, patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

const battle = (patch: BattleStatePatch = {}) => patchBattleState({ rng: () => 0.99, ...patch });

describe("card and turn reaction ordering", () => {
  it("the Mask preserves a reserved critical hit and stops regeneration after its kill", () => {
    const initial = battle({
      enemyHealth: 1,
      playerHealth: 10,
      playerMaxHealth: 40,
      playerStatuses: { poison: 2 },
      flags: { nextHitCrit: true },
      trinketEffects: { plagueDoctorPoisonCleanse: 2, boneCharmHealOnKill: 3 },
      gearEffects: { healthPerTurn: 4 },
    });
    const texts: Parameters<typeof advanceToPlayerTurn>[1] = [];
    const result = advanceToPlayerTurn(initial, texts);
    expect(result.flags.nextHitCrit).toBe(true);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "poison", amount: 1 });
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(13);
    expect(initial.playerStatuses.poison).toBe(2);
  });

  it("a hit does not spend Forge awarded by its Stun", () => {
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] });
    const result = playBattleCardResolved(
      battle({
        enemyHealth: 30,
        enemyMaxHealth: 30,
        hand: [card],
        talentEffects: { physicalStunChance: 100, forgeOnStun: 2 },
      }),
      card.id,
      0,
    ).state;
    expect(result.enemyCC.stunSkipTurns).toBe(1);
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("Phoenix shares Emberforged's once-per-turn reward with card attacks", () => {
    let state = battle({
      activeCompanion: companionLibrary.phoenix,
      gearEffects: { forgeOnBurnDealt: 2 },
    });
    state = processCompanionTurnStart(state, []);
    expect(state.playerStatuses.forge).toBe(2);
    expect(state.flags.emberforgedUsedThisTurn).toBe(true);
    state = processCompanionTurnStart(state, []);
    const card = cardById.fireball!;
    state = playBattleCardResolved({ ...state, hand: [card] }, card.id, 0).state;
    expect(state.playerStatuses.forge).toBe(2);
    state = processCompanionTurnStart(advanceToPlayerTurn(state), []);
    expect(state.playerStatuses.forge).toBe(4);
  });

  it.each([false, true])(
    "pre-card Cinder Skin resolves before the card; Death's Door available=%s",
    (protectedHero) => {
      const card = cardById.fireball!;
      const result = playBattleCardResolved(
        battle({
          enemyHealth: 10,
          enemyMaxHealth: 10,
          playerHealth: 1,
          deathsDoorUsed: !protectedHero,
          hand: [card],
          currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
          playerStatuses: { forge: 2 },
          talentEffects: { forgeOnBurnCard: 1, forgeBurnThreshold: 3, forgeBurnDamage: 1 },
        }),
        card.id,
        0,
      ).state;
      expect(result.playerHealth).toBe(protectedHero ? 1 : 0);
      expect(result.enemyHealth).toBe(protectedHero ? 7 : 9);
      expect(result.flags.pendingCinderSkinReaction).toBe(false);
    },
  );

  it("Desperate Guard and Last Resort see the damage crossing before Block-break healing", () => {
    const initial = battle({
      playerHealth: 21,
      playerMaxHealth: 40,
      playerStatuses: { block: 1 },
      gearEffects: { blockDepletedHeal: 2 },
      talentEffects: { healthThresholdBlock: { threshold: 50, amount: 6 } },
    });
    const guarded = processEnemyDamageEffect(initial, { kind: "damage", damageType: "physical", amount: 3 }, []);
    expect(guarded.playerStatuses.block).toBe(6);
    expect(guarded.playerHealth).toBe(21);
    const cleansed = processEnemyDamageEffect(
      battle({
        playerHealth: 11,
        playerMaxHealth: 40,
        playerStatuses: { block: 1 },
        gearEffects: { blockDepletedHeal: 2 },
        talentEffects: { cleanseBelowHealthPercent: 25 },
      }),
      { kind: "damage", damageType: "burn", amount: 3 },
      [],
    );
    expect(cleansed.playerHealth).toBe(11);
    expect(cleansed.playerStatuses.burn).toBe(0);
  });

  it.each([0, 100])(
    "Cauterize decays Armor only after positive mitigated self-damage (resistance %s)",
    (resistBurn) => {
      const card = cardById.cauterize!;
      const result = playBattleCardResolved(
        battle({
          hand: [card],
          playerHealth: 30,
          playerStatuses: { poison: 1, armor: 1 },
          gearEffects: { resistBurn },
          talentEffects: { armorBreakBlock: 3 },
        }),
        card.id,
        0,
      ).state;
      expect(result.playerHealth).toBe(resistBurn ? 30 : 29);
      expect(result.playerStatuses.armor).toBe(resistBurn ? 1 : 0);
      expect(result.playerStatuses.block).toBe(resistBurn ? 0 : 3);
    },
  );

  it("Mending applies once to opening healing, including caps and healing reactions", () => {
    const modifiers = battle({ talentEffects: { healMultiplier: 1.1 }, gearEffects: { startHeal: 5 } });
    const start = (maxHealth: number) =>
      createBattleStartState({
        runDeck: [],
        currentEnemy: enemyById.skeleton!,
        playerHealth: 10,
        maxHealth,
        talentEffects: modifiers.talentEffects,
        gearEffects: modifiers.gearEffects,
        trinketIds: ["groves-favor"],
        rng: () => 0.99,
        appliesFightPacing: false,
      });
    expect(start(40).playerHealth).toBe(16);
    const capped = start(14);
    expect(capped.playerHealth).toBe(14);
    expect(capped.playerStatuses.thorns).toBeGreaterThan(0);
  });
});

describe("Red Harvest instance tracking", () => {
  function discardedHarvest(): BattleState {
    const card = { ...cardById.stab!, uid: 50 };
    let state = battle({
      hand: [card],
      deck: [],
      discard: [],
      nextCardUid: 100,
      enemyHealth: 1000,
      enemyMaxHealth: 1000,
      gearEffects: { returnFirstPhysicalCard: 1 },
    });
    state = playBattleCardResolved(state, card.id, 0).state;
    expect(computeEffectiveCost(state, state.hand[0]!).effectiveCost).toBe(0);
    return playBattleCardResolved(state, card.id, 0).state;
  }

  it("Twin Casting keeps the discount on the matching card instance", () => {
    const discarded = discardedHarvest();
    const card = { ...discarded.discard[0]!, tags: ["freeze" as const] };
    const fireball = cardById.fireball!;
    const result = playBattleCardResolved(
      {
        ...discarded,
        hand: [fireball],
        deck: [card],
        discard: [],
        gearEffects: { ...discarded.gearEffects, elementalTwinCasting: 1 },
      },
      fireball.id,
      0,
    ).state;
    expect(result.hand[0]!.id).toBe(card.id);
    expect(result.hand[0]!.uid).not.toBe(card.uid);
    expect(computeEffectiveCost(result, result.hand[0]!).effectiveCost).toBe(0);
  });

  it.each(["normal", "keyword", "automatic"] as const)(
    "discount survives %s draws, save/resume, and expires next turn",
    (kind) => {
      let state = discardedHarvest();
      if (kind === "automatic") {
        let rolls = 0;
        state = resolveEnemyAttackHit(
          {
            ...state,
            gearEffects: { ...state.gearEffects, dodgeDrawAndPlay: 1 },
            rng: () => (rolls++ === 0 ? 0 : 0.99),
          },
          { kind: "damage", damageType: "physical", amount: 1 },
          [],
          { canDodge: true },
        ).state;
      }
      state = kind === "keyword" ? drawKeywordCard(state, "physical") : applyDrawResult(state, drawFromState(state, 1));
      expect(computeEffectiveCost(state, state.hand[0]!).effectiveCost).toBe(0);
      expect(computeEffectiveCost(state, { ...state.hand[0]!, uid: 999 }).effectiveCost).toBe(1);
      const saved = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(battleSnapshot(state))));
      expect(saved.uniqueGear.redHarvestUid).toBe(state.hand[0]!.uid);
      expect(computeEffectiveCost(advanceToPlayerTurn(state), state.hand[0]!).effectiveCost).toBe(1);
    },
  );
});

describe("Companion descriptions match their own damage scaling", () => {
  it.each(["phoenix", "fox"] as const)("shows Gear, Bond, Mana, and conditional bonuses for %s", (id) => {
    const companion = companionLibrary[id];
    const state = battle({
      activeCompanion: companion,
      rng: () => 0.4,
      enemyHealth: 20,
      enemyMaxHealth: 100,
      maxMana: 4,
      enemyCC: { freezeSkipTurns: 1 },
      gearEffects: { companionDamageBonus: 4 },
      talentEffects: {
        companionBondLevels: { ...defaultCompanionBondLevels, [id]: 1 },
        companionDamagePerManaCrystal: 1,
        companionVsFrozenBonus: 2,
        companionBleedDamageBonus: 3,
        companionDoubledVsLowHealth: true,
      },
    });
    const modifiers = getBattleCompanionDamageModifiers(state);
    const description = getCompanionDescriptionLines(companion, 1, modifiers);
    const expected = id === "phoenix" ? 20 : 26;
    expect(description[0]).toContain(`Deals ${expected} `);
    const texts: Parameters<typeof processCompanionTurnStart>[1] = [];
    processCompanionTurnStart(state, texts);
    expect(texts).toContainEqual({
      target: "enemy",
      kind: "damage",
      stat: id === "phoenix" ? "burn" : "bleed",
      amount: expected,
    });
    const summon = makeTestCard({
      effects: [{ kind: "summon-companion", companionId: id }],
      descriptionLines: ["old", "Companion"],
    });
    expect(
      getEffectiveCardDescriptionLines(summon, {
        companionBondLevels: { [id]: 1 },
        companionDamageModifiers: modifiers,
      })[0],
    ).toBe(description[0]);
    expect(getCompanionDescriptionLines(companion)[0]).toContain("Deals 1 ");
  });
});
