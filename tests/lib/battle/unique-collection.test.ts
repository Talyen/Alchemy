import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { patchBattleState, makeTestCard, type BattleStatePatch } from "../../fixtures/battle";
import { companionLibrary, type BattleCard, type DamageType } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle/types";
import { addPlayerStatus } from "@/lib/battle/types";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { addGoldWithCombatText } from "@/lib/battle/combat-text";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { repeatUniqueCardDamage } from "@/lib/battle/unique-card-effects";

function battle(patch: BattleStatePatch = {}): BattleState {
  return patchBattleState({
    enemyHealth: 1000,
    enemyMaxHealth: 1000,
    playerHealth: 100,
    playerMaxHealth: 100,
    mana: 10,
    maxMana: 10,
    nextCardUid: 100,
    rng: () => 0.99,
    ...patch,
  });
}

function attack(type: DamageType, extra: Partial<BattleCard> = {}): BattleCard {
  return makeTestCard({
    id: type,
    uid: 1,
    cost: 2,
    effects: [{ kind: "damage", damageType: type, amount: 10 }],
    ...extra,
  });
}

function play(state: BattleState, card: BattleCard): BattleState {
  return playBattleCardResolved({ ...state, hand: [card] }, card.id, 0).state;
}

function dodge(state: BattleState): BattleState {
  let roll = 0;
  return applyEnemyAbility(
    {
      ...state,
      rng: () => (roll++ === 0 ? 0 : 0.99),
    },
    makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] }),
    [],
  );
}

describe("Unique damage and resource rules", () => {
  it("Unclosing Wound halves Bleed repeatedly and eventually expires", () => {
    let state = battle({ gearEffects: { bleedDecaysByHalf: 1 }, enemyStatuses: { bleed: 8 } });
    const remaining = [];
    for (let turn = 0; turn < 4; turn++) {
      state = tickEnemyStatuses(state, []);
      remaining.push(state.enemyStatuses.bleed);
    }
    expect(remaining).toEqual([4, 2, 1, 0]);
    expect(state.enemyHealth).toBe(985);
  });

  it("Blackfletch counts every remaining Unclosing Wound payment", () => {
    const state = battle({ gearEffects: { bleedDecaysByHalf: 1 }, enemyStatuses: { bleed: 8 } });
    const result = detonateEnemyStatuses(state, ["bleed"], [], "remaining-ticks");
    expect(result.enemyHealth).toBe(985);
    expect(result.enemyStatuses.bleed).toBe(0);
  });

  it("Kingbreaker turns Armor into Stun damage while retaining Block", () => {
    const state = battle({ gearEffects: { armorIncreasesStun: 1 }, enemyMitigation: { armor: 8, block: 4 } });
    const result = play(state, attack("stun"));
    expect(result.enemyHealth).toBe(986);
    expect(result.enemyStatuses.stun).toBe(14);
    expect(play(state, attack("physical")).enemyHealth).toBe(1000);
  });

  it("Oathkeeper strengthens Holy damage without spending Forge", () => {
    const result = play(
      battle({ gearEffects: { holyPreservesForge: 1 }, playerStatuses: { forge: 5 } }),
      attack("holy"),
    );
    expect(result.enemyHealth).toBe(985);
    expect(result.playerStatuses.forge).toBe(5);
  });

  it("Patient Edge restores only Forge spent on attacks, once per turn", () => {
    const state = play(
      battle({ gearEffects: { recoverSpentForge: 1 }, playerStatuses: { forge: 5 } }),
      attack("physical"),
    );
    expect(state.playerStatuses.forge).toBe(4);
    expect(state.uniqueGear.spentForge).toBe(1);
    const restored = advanceToPlayerTurn(state);
    expect(restored.playerStatuses.forge).toBe(5);
    expect(restored.uniqueGear.spentForge).toBe(0);
    expect(advanceToPlayerTurn(restored).playerStatuses.forge).toBe(5);
  });

  it("Lingering Bell retains a quarter of buildup without immediately Stunning again", () => {
    const result = resolveStunTrigger(battle({ gearEffects: { retainStunBuildup: 1 }, enemyStatuses: { stun: 600 } }));
    expect(result.enemyStatuses.stun).toBe(150);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
    expect(resolveStunTrigger(result).enemyCC).toEqual(result.enemyCC);
  });

  it("Bloodember shares flat bonuses in both directions and conditional bonuses only once", () => {
    const state = battle({
      gearEffects: {
        sharedBurnBleedBonuses: 1,
        flatBurnDamage: 4,
        flatBleedDamage: 4,
        burnDamageBonusToBleedingPercent: 20,
      },
      enemyStatuses: { bleed: 1 },
    });
    expect(play(state, attack("burn")).enemyHealth).toBe(978);
    expect(play(state, attack("bleed")).enemyHealth).toBe(978);
    expect(play({ ...state, enemyStatuses: { ...state.enemyStatuses, bleed: 0 } }, attack("bleed")).enemyHealth).toBe(
      982,
    );
  });

  it("Bloodember applies the shared conditional bonus to later Bleed damage and Blackfletch's total", () => {
    const state = battle({
      gearEffects: { sharedBurnBleedBonuses: 1, burnDamageBonusToBleedingPercent: 20, bleedDecaysByHalf: 1 },
      enemyStatuses: { bleed: 8 },
    });
    expect(tickEnemyStatuses(state, []).enemyHealth).toBe(990);
    expect(detonateEnemyStatuses(state, ["bleed"], [], "remaining-ticks").enemyHealth).toBe(982);
  });

  it("Serpent's Eye bypasses Armor and Dodge only against Poisoned enemies", () => {
    const state = battle({
      gearEffects: { poisonedAttacksPierce: 1 },
      enemyStatuses: { poison: 1 },
      enemyMitigation: { armor: 100, block: 3 },
      rng: () => 0,
    });
    const result = play(state, attack("physical"));
    expect(result.enemyHealth).toBe(983);
    expect(result.enemyMitigation.armor).toBe(99);
    expect(
      play({ ...state, enemyStatuses: { ...state.enemyStatuses, poison: 0 } }, attack("physical")).enemyHealth,
    ).toBe(1000);
  });

  it("Golden Crucible grants actual Gold as Forge, spends no Gold, and strengthens Holy", () => {
    const earned = addGoldWithCombatText(
      battle({ gold: 50, gearEffects: { goldGrantsForgeAndHoly: 1, goldGainPercent: 20 } }),
      5,
    );
    expect(earned.gold).toBe(56);
    expect(earned.playerStatuses.forge).toBe(6);
    const result = play(earned, attack("holy"));
    expect(result.enemyHealth).toBe(984);
    expect(result.playerStatuses.forge).toBe(5);
    expect(result.gold).toBe(56);
  });
});

describe("Unique card opportunities", () => {
  it("Everkeen repeats damage without repeating utility or preparing itself again", () => {
    const card = attack("physical", {
      effects: [
        { kind: "damage", damageType: "physical", amount: 10 },
        { kind: "damage", damageType: "burn", amount: 10 },
        { kind: "restore-mana", amount: 1 },
      ],
    });
    const charged = addPlayerStatus(
      battle({ gearEffects: { forgeReadiesPhysicalRepeat: 1, forgeOnBurnDealt: 2 } }),
      "forge",
      4,
    );
    const result = play(charged, card);
    expect(result.mana).toBe(9);
    expect(result.enemyHealth).toBeLessThan(960);
    expect(result.uniqueGear.everkeenReady).toBe(true);
    const second = play(result, attack("physical"));
    expect(second.uniqueGear.everkeenReady).toBe(false);
    expect(second.enemyHealth).toBeLessThan(result.enemyHealth - 20);
  });

  it("Red Harvest returns one card and its discount expires next turn", () => {
    const card = attack("physical");
    const first = play(battle({ gearEffects: { returnFirstPhysicalCard: 1 } }), card);
    expect(first.hand).toHaveLength(1);
    expect(first.discard).toHaveLength(0);
    expect(computeEffectiveCost(first, first.hand[0]!).effectiveCost).toBe(1);
    const returned = first.hand[0]!;
    const second = playBattleCardResolved(first, returned.id, 0).state;
    expect(second.hand).toHaveLength(0);
    expect(second.discard).toHaveLength(1);
    const next = advanceToPlayerTurn(second);
    expect(computeEffectiveCost(next, next.hand[0]!).effectiveCost).toBe(2);
    expect(next.uniqueGear.redHarvestUsed).toBe(false);
  });

  it("Red Harvest never returns a Consumed card", () => {
    const result = play(battle({ gearEffects: { returnFirstPhysicalCard: 1 } }), attack("physical", { consume: true }));
    expect(result.hand).toHaveLength(0);
    expect(result.exhausted).toHaveLength(1);
  });

  it("Huntsmaster repeats Companion damage but not Mana restoration, once per turn", () => {
    const companion = {
      ...companionLibrary.wolf!,
      turnStartEffects: [
        { kind: "damage" as const, damageType: "nature" as const, amount: 7 },
        { kind: "restore-mana" as const, amount: 5 },
      ],
    };
    const state = battle({ gearEffects: { firstArcheryCompanionAttack: 1 }, activeCompanion: companion });
    const card = attack("physical", { tags: ["archery"] });
    const result = play(state, card);
    expect(result.enemyHealth).toBe(983);
    expect(result.mana).toBe(8);
    expect(play(result, card).enemyHealth).toBe(973);
  });

  it("Returning Gale repeats actual damage effects next turn without repeating utility or echoing forever", () => {
    const card = attack("physical", {
      tags: ["archery"],
      effects: [
        { kind: "damage", damageType: "physical", amount: 10 },
        { kind: "restore-mana", amount: 1 },
      ],
    });
    const state = play(battle({ gearEffects: { archeryEchoNextTurn: 1 } }), card);
    expect(state.uniqueGear.archeryEchoes).toHaveLength(1);
    expect(state.mana).toBe(9);
    const next = advanceToPlayerTurn(state);
    expect(next.enemyHealth).toBe(985);
    expect(next.uniqueGear.archeryEchoes).toHaveLength(0);
    expect(next.mana).toBe(10);
    expect(advanceToPlayerTurn(next).enemyHealth).toBe(985);
  });

  it("Final Spark requires spending the last Mana and only repeats damage once per turn", () => {
    const card = attack("burn");
    const state = play(battle({ mana: 2, gearEffects: { lastManaElementalRepeat: 1 } }), card);
    expect(state.enemyHealth).toBe(980);
    expect(state.uniqueGear.finalSparkUsed).toBe(true);
    expect(play({ ...state, mana: 2 }, card).enemyHealth).toBe(970);
    const free = play(battle({ mana: 0, gearEffects: { lastManaElementalRepeat: 1 } }), attack("burn", { cost: 0 }));
    expect(free.enemyHealth).toBe(990);
    expect(free.uniqueGear.finalSparkUsed).toBe(false);
  });

  it("damage repeats do not apply Potion potency twice", () => {
    const result = play(
      battle({ mana: 2, gearEffects: { lastManaElementalRepeat: 1 }, talentEffects: { potionPotency: 2 } }),
      attack("burn", { id: "fire-potion" }),
    );
    expect(result.enemyHealth).toBe(960);
  });

  it("Returning Flight recovers the existing card before a reshuffle and discounts only its next play", () => {
    const card = attack("physical", { tags: ["archery"] });
    const state = play(battle({ gearEffects: { recoverLastArcheryCard: 1 } }), card);
    const next = advanceToPlayerTurn(state);
    expect(next.hand).toHaveLength(1);
    expect(next.discard).toHaveLength(0);
    expect(computeEffectiveCost(next, next.hand[0]!).effectiveCost).toBe(1);
    const result = playBattleCardResolved(next, card.id, 0).state;
    expect(result.mana).toBe(9);
    expect(result.uniqueGear.returningFlightUid).toBeNull();
  });

  it("Threefold Grace grants separate free cards each turn and counts all keywords on a mixed card", () => {
    const mixed = attack("burn", { tags: ["burn", "freeze"], cost: 4 });
    const state = play(battle({ mana: 0, gearEffects: { firstElementalCardsFree: 1 } }), mixed);
    expect(state.enemyHealth).toBe(990);
    expect(state.uniqueGear.freeBurnUsed).toBe(true);
    expect(state.uniqueGear.freeFreezeUsed).toBe(true);
    expect(computeEffectiveCost(state, attack("freeze")).effectiveCost).toBe(2);
    expect(computeEffectiveCost(state, attack("holy")).effectiveCost).toBe(0);
    expect(computeEffectiveCost(advanceToPlayerTurn(state), attack("freeze")).effectiveCost).toBe(0);
  });

  it("Winter's Credit pays only the missing Mana with Block and rejects unaffordable cards", () => {
    const card = attack("freeze", { cost: 3 });
    const state = battle({
      mana: 1,
      hand: [card],
      playerStatuses: { block: 6 },
      gearEffects: { blockPaysFreezeMana: 1 },
    });
    expect(canPlayCard(state, card, 0)).toBe(true);
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.mana).toBe(0);
    expect(result.playerStatuses.block).toBe(0);
    const poor = { ...state, playerStatuses: { ...state.playerStatuses, block: 5 } };
    expect(canPlayCard(poor, card, 0)).toBe(false);
    expect(playBattleCardResolved(poor, card.id, 0).state).toBe(poor);
    expect(canPlayCard({ ...state, hand: [attack("burn", { cost: 3 })] }, attack("burn", { cost: 3 }), 0)).toBe(false);
  });
});

describe("Unique Dodge and Block rewards", () => {
  it("Viper's Courtesy survives automatic plays and benefits one successful Physical card hit", () => {
    const dodged = dodge(battle({ gearEffects: { dodgeReadiesVenomousHit: 1 } }));
    expect(dodged.uniqueGear.viperReady).toBe(true);
    const automatic = applyCardEffects(dodged, attack("physical"), []);
    expect(automatic.uniqueGear.viperReady).toBe(true);
    const result = play({ ...automatic, rng: () => 0.99 }, attack("physical"));
    expect(result.enemyStatuses.poison).toBe(5);
    expect(result.enemyStatuses.bleed).toBe(5);
    expect(result.uniqueGear.viperReady).toBe(false);
  });

  it("Wrenflight grants a non-additive Dodge bonus and draws an Archery card on Dodge", () => {
    const arrow = attack("physical", { tags: ["archery"] });
    const state = play(battle({ gearEffects: { archeryDodgeAndDraw: 1 }, deck: [arrow] }), arrow);
    expect(state.uniqueGear.wrenflightActive).toBe(true);
    let calls = 0;
    const result = applyEnemyAbility(
      {
        ...state,
        rng: () => (calls++ === 0 ? 0.1 : 0.99),
      },
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 20 }] }),
      [],
    );
    expect(result.playerHealth).toBe(100);
    expect(result.hand).toHaveLength(1);
    expect(advanceToPlayerTurn(result).uniqueGear.wrenflightActive).toBe(false);
  });

  it("Laughing Guard spends old Block before Dodge bonuses and preserves the remainder between turns", () => {
    const result = dodge(
      battle({ playerStatuses: { block: 20 }, gearEffects: { dodgeSpendsPreservedBlock: 1, blockOnDodge: 5 } }),
    );
    expect(result.playerStatuses.block).toBe(15);
    expect(result.enemyHealth).toBe(990);
    expect(advanceToPlayerTurn(result).playerStatuses.block).toBe(15);
  });

  it("Knight's Answer requires absorbed damage, grants one free Physical card, and does not protect Armor", () => {
    const state = battle({ playerStatuses: { block: 2, armor: 1 }, gearEffects: { blockReadiesFreePhysical: 1 } });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 10 }, []);
    expect(result.playerHealth).toBe(93);
    expect(result.playerStatuses.armor).toBe(0);
    expect(result.uniqueGear.knightsAnswerReady).toBe(true);
    const played = play({ ...result, mana: 0 }, attack("physical"));
    expect(played.uniqueGear.knightsAnswerReady).toBe(false);
    expect(computeEffectiveCost(played, attack("physical")).effectiveCost).toBe(2);
    const unblocked = processEnemyDamageEffect(
      { ...state, playerStatuses: { ...state.playerStatuses, block: 0 } },
      { kind: "damage", damageType: "physical", amount: 10 },
      [],
    );
    expect(unblocked.uniqueGear.knightsAnswerReady).toBe(false);
  });

  it("Wildheart's Favor makes the next Nature card free and all of its hits critical", () => {
    const card = attack("nature", {
      effects: [
        { kind: "damage", damageType: "nature", amount: 10 },
        { kind: "damage", damageType: "nature", amount: 5 },
      ],
    });
    const state = dodge(battle({ gearEffects: { dodgeReadiesNatureCrit: 1 }, mana: 0 }));
    const result = play({ ...state, rng: () => 0.99 }, card);
    expect(result.enemyHealth).toBe(970);
    expect(result.mana).toBe(0);
    expect(result.uniqueGear.wildheartReady).toBe(false);
  });
});

describe("Unique combat saves", () => {
  it("Winter's Credit and Rimeheart pay Block first, and Final Spark repeats only once", () => {
    const card = attack("freeze", { cost: 3, effects: [{ kind: "damage", damageType: "freeze", amount: 15 }] });
    const result = play(
      battle({
        mana: 1,
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyStatuses: { freeze: 40 },
        playerStatuses: { block: 6 },
        gearEffects: { blockPaysFreezeMana: 1, freezeGrantsBlockAndMana: 1, lastManaElementalRepeat: 1 },
      }),
      card,
    );
    expect(result.enemyHealth).toBe(70);
    expect(result.playerStatuses.block).toBe(30);
    expect(result.mana).toBe(8);
    expect(result.uniqueGear.finalSparkUsed).toBe(true);
  });

  it("Golden Verdict feeds Golden Crucible while Oathkeeper preserves the resulting Forge", () => {
    const result = play(
      battle({
        gold: 25,
        enemyStatuses: { stun: 495 },
        gearEffects: { holyStunBuildupGold: 1, goldGrantsForgeAndHoly: 1, holyPreservesForge: 1 },
      }),
      attack("holy"),
    );
    expect(result.gold).toBe(26);
    expect(result.playerStatuses.forge).toBe(1);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });

  it("Forge earned by a damage repeat cannot prepare another Everkeen repeat", () => {
    const result = repeatUniqueCardDamage(
      battle({
        gearEffects: { forgeReadiesPhysicalRepeat: 1 },
        talentEffects: { forgeOnBurnDealt: 2 },
      }),
      attack("burn"),
      [],
    );
    expect(result.playerStatuses.forge).toBe(2);
    expect(result.uniqueGear.everkeenReady).toBe(false);
    expect(result.flags.uniqueRepeatActive).toBe(false);
  });

  it("full hands leave Red Harvest in discard without losing or duplicating cards", () => {
    const card = attack("physical", {
      effects: [
        { kind: "draw-cards", amount: 7 },
        { kind: "damage", damageType: "physical", amount: 10 },
      ],
    });
    const deck = Array.from({ length: 7 }, (_, i) => attack("holy", { id: "filler-" + i }));
    const result = play(battle({ deck, gearEffects: { returnFirstPhysicalCard: 1 } }), card);
    expect(result.hand).toHaveLength(7);
    expect(result.discard).toEqual([card]);
    expect(result.uniqueGear.redHarvestUid).toBeNull();
  });

  it("restoring a used free-card allowance never grants a second free play", () => {
    const card = attack("burn");
    const state = play(battle({ mana: 0, gearEffects: { firstElementalCardsFree: 1 } }), card);
    const restored = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    const ready = { ...restored, hand: [card], rng: () => 0.99 };
    expect(canPlayCard(ready, card, 0)).toBe(false);
    expect(playBattleCardResolved(ready, card.id, 0).state).toBe(ready);
  });

  it("defaults older saves without changing their captured effects", () => {
    const saved = battle();
    const { uniqueGear: _unique, ...legacy } = saved;
    const restored = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(legacy)));
    expect(restored.uniqueGear).toEqual(saved.uniqueGear);
    expect(restored.gearEffects).toEqual(saved.gearEffects);
  });

  it("preserves charges, spent allowances, and delayed arrows through reload", () => {
    const card = attack("physical", { tags: ["archery"] });
    const state = play(
      battle({
        gearEffects: { archeryEchoNextTurn: 1 },
        uniqueGear: { wildheartReady: true, freeBurnUsed: true, spentForge: 3 },
      }),
      card,
    );
    const restored = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(restored.uniqueGear).toEqual(state.uniqueGear);
    const replayed = advanceToPlayerTurn({ ...restored, rng: () => 0.99 });
    expect(replayed.enemyHealth).toBe(985);
    expect(replayed.uniqueGear.archeryEchoes).toHaveLength(0);
    expect(replayed.uniqueGear.wildheartReady).toBe(true);
  });
});
