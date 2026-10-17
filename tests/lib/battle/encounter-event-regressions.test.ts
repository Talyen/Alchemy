import { describe, expect, it, vi } from "vitest";
import { cardById, computeTalentEffects, type BattleCard } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { resolveCardEffectChain } from "@/lib/battle/card-play-effects";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { drawOpeningHand } from "@/lib/battle/battle-setup";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { applyEmergencyWishForEmptyDraw, upgradeWishCard } from "@/lib/battle/wish";
import { BattleCardEffectSchema } from "@/lib/game-data";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { applyNumericCorruption, getEditableCorruptionTargets } from "@/lib/corruption/numeric";
import { makeTestCard, patchBattleState, regressionBattle } from "../../fixtures/battle";

function battle(trait: string) {
  return regressionBattle({
    currentEnemy: { traits: [{ id: trait, title: trait, description: "" }] },
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 10,
    playerMaxHealth: 40,
  });
}

describe("encounter event regressions", () => {
  it("Jealous reacts to each Wish in a single or multi-Wish card", () => {
    const card = makeTestCard({ effects: [{ kind: "wish", amount: 2 }] });
    const played = playBattleCardResolved({ ...battle("jealous"), hand: [card] }, card.id, 0).state;
    expect(played.wishOptions).not.toBeNull();
    expect(played.wishQueue).toHaveLength(1);
    expect(played.enemyPhysicalDamageBonus).toBe(2);
  });

  it("Dance of Blades feeds Insatiable when it consumes a Potion and does not reuse Follow-through", () => {
    const state = battle("insatiable");
    const result = resolveEnemyAttackHit(
      {
        ...state,
        deck: [cardById["health-potion"]!],
        gearEffects: { ...state.gearEffects, dodgeDrawAndPlay: 1 },
        rng: () => 0,
      },
      { kind: "damage", damageType: "physical", amount: 1 },
      [],
      { canDodge: true },
    ).state;
    expect(result.exhausted.map((card) => card.id)).toContain("health-potion");
    expect(result.enemyPhysicalDamageBonus).toBe(1);

    const arrow = makeTestCard({
      tags: ["archery"],
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const followState = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: computeTalentEffects({ archery: ["archery-hail"] }),
      flags: { archeryCardsPlayedThisTurn: 2, archerySecondCardActive: true },
      rng: () => 0.99,
    });
    const automatic = resolveCardEffectChain(followState, arrow, []).state;
    expect(automatic.enemyHealth).toBe(96);
    expect(automatic.flags.archeryCardsPlayedThisTurn).toBe(2);
  });

  it.each([0.25, 0.75])("Holy Retribution follows a legacy Roll the Dice's resolved branch (%s)", (roll) => {
    const card: BattleCard = {
      ...cardById["roll-the-dice"]!,
      consume: false,
      descriptionLines: ["Deal 3 Random damage or gain 3 Gold"],
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "random-damage", minAmount: 3, maxAmount: 3 }],
          failureEffects: [{ kind: "gain-gold", amount: 3 }],
        },
      ],
    };
    const result = playBattleCardResolved(
      { ...battle("holy-retribution"), hand: [card], rng: () => roll },
      card.id,
      0,
    ).state;
    expect(result.playerHealth).toBe(roll < 0.5 ? 9 : 10);
  });

  it.each([true, false])("automatic Consume rewards respect survival with Death's Door spent: %s", (spent) => {
    const state = battle("holy-retribution");
    const result = resolveEnemyAttackHit(
      {
        ...state,
        playerHealth: 1,
        deathsDoorUsed: spent,
        deck: [cardById["acid-potion"]!],
        gearEffects: { ...state.gearEffects, dodgeDrawAndPlay: 1 },
        talentEffects: { ...state.talentEffects, goldOnConsume: 1, goldOnConsumeChance: 100 },
        rng: () => 0,
      },
      { kind: "damage", damageType: "physical", amount: 1 },
      [],
      { canDodge: true },
    ).state;
    expect(result.playerHealth).toBe(spent ? 0 : 1);
    expect(result.deathsDoorActive).toBe(!spent);
    expect(result.gold - state.gold).toBe(spent ? 0 : 1);
    expect(result.exhausted.map((card) => card.id)).toContain("acid-potion");
  });

  it("fatal Cinder Skin retaliation stops subsequent Wish and Leech recovery", () => {
    const card = makeTestCard({
      cost: 0,
      effects: [{ kind: "damage", damageType: "bleed", amount: 2, lifesteal: true }],
    });
    const state = regressionBattle({
      hand: [card],
      playerHealth: 1,
      deathsDoorUsed: true,
      enemyHealth: 40,
      enemyMaxHealth: 40,
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      talentEffects: { drawOnBleedDamageChance: 100, burnOnWish: 1, healthPerMana: 1 },
      gearEffects: { manaOnWish: 1 },
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.playerHealth).toBe(0);
  });

  it("keeps Grounding and status resistance on Sundered Guard attacks that strip the last Block, and respects Saintfall prevention", () => {
    const sundered = patchBattleState({
      rng: () => 0.99,
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 2 },
      talentEffects: { blockPreventsStun: true, blockHalvesPoisonDamage: true },
      currentEnemy: { traits: [{ id: "sundered-guard", title: "Sundered Guard", description: "" }] },
    });
    expect(
      resolveEnemyAttackHit(sundered, { kind: "damage", damageType: "stun", amount: 4 }, [], { canDodge: true }).state
        .playerStatuses.stun,
    ).toBe(0);
    expect(
      resolveEnemyAttackHit(sundered, { kind: "damage", damageType: "poison", amount: 4 }, [], { canDodge: true }).state
        .playerHealth,
    ).toBe(28);

    const saintfall = patchBattleState({
      rng: () => 0.5,
      playerHealth: 20,
      playerMaxHealth: 40,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerStatuses: { block: 1 },
      gearEffects: { saintfallRetribution: 4 },
      talentEffects: { holyBlockChance: 100 },
      enemyMitigation: { block: 4 },
    });
    const reflected = processEnemyDamageEffect(saintfall, { kind: "damage", damageType: "physical", amount: 1 }, []);
    expect(reflected.enemyHealth).toBe(100);
    expect(reflected.playerStatuses.block).toBe(0);
  });

  it("preserves reentrant DoT/threshold state, opening-draw queue order, and skips post-kill Stun/Archery rolls", () => {
    const dotState = regressionBattle({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 2, burn: 4 },
      talentEffects: { drawOnBleedDamageChance: 100, burnOnWish: 3 },
      onEmptyDraw: applyEmergencyWishForEmptyDraw,
    });
    const detonated = detonateEnemyStatuses(dotState, ["bleed", "burn"], []);
    expect(detonated.enemyStatuses.burn).toBe(3);

    const aegisState = regressionBattle({
      enemyHealth: 12,
      enemyMaxHealth: 20,
      enemyStatuses: { poison: 1 },
      currentEnemy: { traits: [{ id: "divine-aegis", title: "Divine Aegis", description: "" }] },
      talentEffects: { poisonStunChance: 100 },
    });
    expect(tickEnemyStatuses(aegisState, []).enemyMitigation.armor).toBe(2);

    const older = makeTestCard({ id: "older", uid: 7 });
    const drawState = regressionBattle({
      hand: Array.from({ length: MAX_HAND_SIZE }, (_, uid) => makeTestCard({ id: `hand-${uid}`, uid })),
      pendingHandCards: [older],
      deck: Array.from({ length: 2 }, (_, index) => makeTestCard({ id: `draw-${index}` })),
      nextCardUid: 8,
    });
    expect(drawOpeningHand(drawState).pendingHandCards.map((card) => card.id)).toEqual(["older", "draw-1", "draw-0"]);

    const lethalCard = makeTestCard({
      tags: ["archery"],
      effects: [{ kind: "damage", damageType: "poison", amount: 4 }],
    });
    const rng = vi.fn(() => 0.99);
    playBattleCardResolved(
      patchBattleState({
        rng,
        enemyHealth: 1,
        hand: [lethalCard],
        talentEffects: { archeryBleedDamageChance: 50, poisonStunChance: 50 },
      }),
      lethalCard.id,
      0,
    );
    expect(rng).toHaveBeenCalledTimes(2);
  });

  it("Powerful Wish upgrades every Luck Potion outcome", () => {
    const potion = upgradeWishCard(cardById["luck-potion"]!);
    expect(potion.descriptionLines[0]).toBe("Gain 5 Mana, Gold, or Block");
    expect(JSON.stringify(potion.effects)).not.toContain('"amount":4');
    const dice = upgradeWishCard(cardById["roll-the-dice"]!);
    expect(dice.descriptionLines).toEqual(cardById["roll-the-dice"]!.descriptionLines);
    expect(dice.effects.every((effect) => BattleCardEffectSchema.safeParse(effect).success)).toBe(true);
    expect(dice.effects).toEqual([{ kind: "random-draw", minAmount: 1, maxAmount: 6 }]);
    const original = cardById["luck-potion"]!;
    const target = getEditableCorruptionTargets(original).at(-1)!;
    const corrupted = applyNumericCorruption(original, target, 1);
    expect(corrupted.descriptionLines[0]).toBe("Gain 5 Mana, Gold, or Block");
    expect(corrupted.effects).toEqual([
      expect.objectContaining({
        successEffects: [{ kind: "restore-mana", amount: 5 }],
        failureEffects: [
          expect.objectContaining({
            successEffects: [{ kind: "gain-gold", amount: 5 }],
            failureEffects: [{ kind: "player-status", status: "block", amount: 5 }],
          }),
        ],
      }),
    ]);
    expect(original.descriptionLines[0]).toBe("Gain 4 Mana, Gold, or Block");
  });
});
