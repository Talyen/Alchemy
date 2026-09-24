import { describe, expect, it } from "vitest";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import { applyScaledLeechHealing } from "@/lib/battle/damage-rider-leech";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { playBattleCardResolved, handlePostPlayCardDestination } from "@/lib/battle/card-play";
import { addGoldWithCombatText, payKillPayouts } from "@/lib/battle/combat-text";
import { tickEnemyPoison } from "@/lib/battle/status-ticks";
import { applyWishEffect } from "@/lib/battle/wish";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const missChance = () => 0.99;

function attack(damageType: "physical" | "nature" | "holy" | "poison", amount: number) {
  const effect = { kind: "damage" as const, damageType, amount };
  const card = makeTestCard({ id: `${damageType}-attack`, effects: [effect] });
  return { card, effect };
}

describe("keyword catalog expansion", () => {
  it("adds Bramblecall only when the Nature card was played without Thorns", () => {
    const { card } = attack("nature", 2);
    const state = patchBattleState({
      hand: [card],
      gearEffects: { thornsOnNatureCardWithoutThorns: 2 },
      rng: missChance,
    });
    expect(playBattleCardResolved(state, card.id, 0).state.playerStatuses.thorns).toBe(2);
    expect(
      playBattleCardResolved({ ...state, playerStatuses: { ...state.playerStatuses, thorns: 1 } }, card.id, 0).state
        .playerStatuses.thorns,
    ).toBe(1);
    const growingCard = makeTestCard({
      id: "nature-thorns",
      effects: [{ kind: "player-status", status: "thorns", amount: 1 }],
      tags: ["nature"],
    });
    expect(
      playBattleCardResolved({ ...state, hand: [growingCard] }, growingCard.id, 0).state.playerStatuses.thorns,
    ).toBe(3);
  });

  it("turns Thorns retaliation into Poison and lost Armor into Stun", () => {
    const enemyAttack = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] });
    const state = patchBattleState({
      enemyHealth: 40,
      enemyMaxHealth: 40,
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { thorns: 2, armor: 2 },
      gearEffects: { poisonOnThornsDamage: 2, stunOnArmorLostToAttack: 3 },
      rng: missChance,
    });
    const result = applyEnemyAbility(state, enemyAttack, []);
    expect(result.playerStatuses.armor).toBeLessThan(2);
    expect(result.enemyStatuses.poison).toBeGreaterThan(0);
    expect(result.enemyStatuses.stun).toBeGreaterThan(0);
  });

  it("heals on combat Gold and pays Tithebound only with Forge remaining", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 20,
      gearEffects: { healOnCombatGoldGain: 2, goldOnKillWithForge: 3 },
    });
    expect(addGoldWithCombatText(state, 1, []).playerHealth).toBe(12);
    const defeated = { ...state, enemyHealth: 0, playerStatuses: { ...state.playerStatuses, forge: 1 } };
    const rewarded = payKillPayouts(defeated, true, []);
    expect(rewarded.gold - state.gold).toBe(3);
    expect(rewarded.playerHealth).toBe(12);
    expect(payKillPayouts({ ...defeated, playerStatuses: state.playerStatuses }, true, []).gold).toBe(state.gold);
    const forgeFromPayout = patchBattleState({
      enemyHealth: 0,
      enemyStatuses: { poison: 1 },
      gearEffects: { goldOnKillWithForge: 3, goldGrantsForgeAndHoly: 1 },
      talentEffects: { goldOnPoisonedKill: 1 },
    });
    expect(payKillPayouts(forgeFromPayout, true, []).gold).toBe(forgeFromPayout.gold + 1);
  });

  it("rewards actual Leech healing with Thorns and low-Health Stun damage", () => {
    const state = patchBattleState({
      playerHealth: 8,
      playerMaxHealth: 20,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      gearEffects: { thornsOnLeechWithoutThorns: 2, stunOnLeechBelowHalfHealth: 2 },
      rng: missChance,
    });
    const healed = applyScaledLeechHealing(state, 4, []);
    expect(healed.playerHealth).toBe(12);
    expect(healed.playerStatuses.thorns).toBe(2);
    expect(healed.enemyHealth).toBeLessThan(30);
    const full = applyScaledLeechHealing({ ...state, playerHealth: 20 }, 4, []);
    expect(full.playerStatuses.thorns).toBe(0);
    expect(full.enemyHealth).toBe(30);
  });

  it("resolves Heartshock through enemy Block and Armor", () => {
    const state = patchBattleState({
      playerHealth: 8,
      playerMaxHealth: 20,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: { block: 2, armor: 1, forge: 0 },
      gearEffects: { stunOnLeechBelowHalfHealth: 4 },
      rng: missChance,
    });
    const healed = applyScaledLeechHealing(state, 4, []);
    expect(healed.enemyMitigation.block).toBe(0);
    expect(healed.enemyHealth).toBe(29);
    expect(healed.enemyStatuses.stun).toBe(1);
  });

  it("discounts an empty-hand Wish and deals Freeze damage on Wish", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      gearEffects: { nextCardDiscountOnEmptyHandWish: 1, freezeOnWish: 3 },
      rng: missChance,
    });
    const wished = applyWishEffect(state, undefined, 1, []);
    expect(wished.flags.nextCardCostReduction).toBe(1);
    expect(wished.enemyHealth).toBeLessThan(30);
    const occupied = applyWishEffect({ ...state, hand: [makeTestCard()] }, undefined, 1, []);
    expect(occupied.flags.nextCardCostReduction).toBe(0);
  });

  it("grants Armor on Consume and Holy damage only when Mana is empty", () => {
    const card = makeTestCard({ consume: true, effects: [] });
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      mana: 0,
      gearEffects: { armorOnConsume: 1, holyOnConsumeWithoutMana: 2 },
      rng: missChance,
    });
    const consumed = handlePostPlayCardDestination(state, card);
    expect(consumed.playerStatuses.armor).toBe(1);
    expect(consumed.enemyHealth).toBeLessThan(30);
    expect(handlePostPlayCardDestination({ ...state, mana: 1 }, card).enemyHealth).toBe(30);
  });

  it("grants conditional Leech, including on low-Health Physical attacks", () => {
    const nature = attack("nature", 4);
    const natureState = patchBattleState({
      enemyHealth: 40,
      enemyMaxHealth: 40,
      enemyStatuses: { poison: 2 },
      playerHealth: 10,
      playerMaxHealth: 20,
      gearEffects: { natureLeechVsPoisoned: 1 },
      rng: missChance,
    });
    expect(dealDamageToEnemy(natureState, nature.card, nature.effect, []).playerHealth).toBeGreaterThan(10);
    expect(
      dealDamageToEnemy(
        { ...natureState, enemyStatuses: { ...natureState.enemyStatuses, poison: 0 } },
        nature.card,
        nature.effect,
        [],
      ).playerHealth,
    ).toBe(10);
    const triggered = resolveFollowUpHit(
      natureState,
      { source: "player-follow-up", damageType: "nature", amount: 4 },
      [],
    );
    expect(triggered.playerHealth).toBeGreaterThan(10);
    const blockedNature = dealDamageToEnemy(
      { ...natureState, enemyMitigation: { ...natureState.enemyMitigation, block: 10 } },
      nature.card,
      nature.effect,
      [],
    );
    expect(blockedNature.playerHealth).toBe(10);
    const nativeLeechEffect = { ...nature.effect, lifesteal: true };
    const nativeLeechCard = makeTestCard({ effects: [nativeLeechEffect] });
    const nativeWithRootmender = dealDamageToEnemy(natureState, nativeLeechCard, nativeLeechEffect, []);
    const nativeWithoutRootmender = dealDamageToEnemy(
      { ...natureState, gearEffects: { ...natureState.gearEffects, natureLeechVsPoisoned: 0 } },
      nativeLeechCard,
      nativeLeechEffect,
      [],
    );
    expect(nativeWithRootmender.playerHealth).toBe(nativeWithoutRootmender.playerHealth);

    const physical = attack("physical", 4);
    const physicalState = patchBattleState({
      enemyHealth: 40,
      enemyMaxHealth: 40,
      playerHealth: 8,
      playerMaxHealth: 20,
      gearEffects: { physicalLeechBelowHalfHealth: 1 },
      rng: missChance,
    });
    expect(dealDamageToEnemy(physicalState, physical.card, physical.effect, []).playerHealth).toBeGreaterThan(8);
    expect(
      dealDamageToEnemy({ ...physicalState, playerHealth: 10 }, physical.card, physical.effect, []).playerHealth,
    ).toBe(10);
  });

  it("adds flat Poison damage to direct hits and ticks against Bleeding enemies", () => {
    const poison = attack("poison", 3);
    const state = patchBattleState({
      enemyHealth: 40,
      enemyMaxHealth: 40,
      enemyStatuses: { bleed: 2, poison: 4 },
      gearEffects: { poisonBonusVsBleeding: 2 },
      rng: missChance,
    });
    const without = { ...state, gearEffects: { ...state.gearEffects, poisonBonusVsBleeding: 0 } };
    expect(dealDamageToEnemy(state, poison.card, poison.effect, []).enemyHealth).toBe(
      dealDamageToEnemy(without, poison.card, poison.effect, []).enemyHealth - 2,
    );
    expect(tickEnemyPoison(state, []).enemyHealth).toBe(tickEnemyPoison(without, []).enemyHealth - 2);
    expect(detonateEnemyStatuses(state, ["poison"], []).enemyHealth).toBe(
      detonateEnemyStatuses(without, ["poison"], []).enemyHealth - 2,
    );
  });

  it("grants Block on an unguarded Holy hit and boosts Holy damage to Stunned enemies", () => {
    const holy = attack("holy", 10);
    const state = patchBattleState({
      enemyHealth: 40,
      enemyMaxHealth: 40,
      enemyCC: { stunSkipTurns: 1 },
      gearEffects: { blockOnHolyHitWithoutBlock: 2, holyBonusVsStunnedPercent: 20 },
      rng: missChance,
    });
    const hit = dealDamageToEnemy(state, holy.card, holy.effect, []);
    expect(hit.playerStatuses.block).toBe(2);
    expect(hit.enemyHealth).toBe(28);
    expect(
      dealDamageToEnemy({ ...state, playerStatuses: { ...state.playerStatuses, block: 1 } }, holy.card, holy.effect, [])
        .playerStatuses.block,
    ).toBe(1);
  });
});
