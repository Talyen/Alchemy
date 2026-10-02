import { describe, expect, it } from "vitest";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { tryTriggerEnemyFreeze } from "@/lib/battle/damage-status-riders";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { applyWishEffect } from "@/lib/battle/wish";
import { cardById } from "@/lib/game-data";
import { createMixedPotion } from "@/lib/alchemist";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("triggered damage defenses", () => {
  it.each(["Stunning", "Shattering", "Icy Heart", "Thunderstone", "Wishfire"])(
    "%s spends enemy Block without granting rewards for absorbed damage",
    (source) => {
      const state = patchBattleState({
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyMitigation: { block: 10, armor: 3 },
        enemyStatuses: { stun: 100, freeze: 100, burn: 1 },
        gearEffects: {
          damageOnStunPhysical: source === "Stunning" ? 6 : 0,
          damageOnFreezePhysical: source === "Shattering" ? 6 : 0,
          burnOnWish: source === "Wishfire" ? 6 : 0,
        },
        trinketEffects: {
          frozenHeartDamage: source === "Icy Heart" ? 6 : 0,
          thunderstoneDamageOnStun: source === "Thunderstone" ? 6 : 0,
        },
        talentEffects: { armorOnPhysicalDamageChance: 100, goldOnNatureDamageChance: 100 },
        rng: () => 0.99,
      });
      const result =
        source === "Wishfire"
          ? applyWishEffect(state, undefined, 1, [])
          : source === "Icy Heart" || source === "Shattering"
            ? tryTriggerEnemyFreeze(state, state, [])
            : resolveStunTrigger(state, []);
      expect(result.enemyHealth).toBe(100);
      expect(result.enemyMitigation).toMatchObject({ block: 4, armor: 3 });
      expect(result.playerStatuses.armor).toBe(0);
      expect(result.gold).toBe(state.gold);
    },
  );

  it.each(["Stunning", "Shattering", "Icy Heart"])("%s respects Physical Armor after Block", (source) => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { block: 1, armor: 3 },
      enemyStatuses: { stun: 100, freeze: 100 },
      gearEffects: {
        damageOnStunPhysical: source === "Stunning" ? 6 : 0,
        damageOnFreezePhysical: source === "Shattering" ? 6 : 0,
      },
      trinketEffects: { frozenHeartDamage: source === "Icy Heart" ? 6 : 0 },
    });
    const result = source === "Stunning" ? resolveStunTrigger(state, []) : tryTriggerEnemyFreeze(state, state, []);
    expect(result.enemyHealth).toBe(98);
    expect(result.enemyMitigation).toMatchObject({ block: 0, armor: 2 });
    expect(state.enemyMitigation).toMatchObject({ block: 1, armor: 3 });
  });

  it.each(["Thunderstone", "Wishfire"])("%s decays Armor on positive damage without Armor mitigation", (source) => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { armor: 3 },
      enemyStatuses: { stun: 100, burn: 1 },
      trinketEffects: { thunderstoneDamageOnStun: source === "Thunderstone" ? 6 : 0 },
      gearEffects: { burnOnWish: source === "Wishfire" ? 6 : 0 },
      rng: () => 0.99,
    });
    const result = source === "Thunderstone" ? resolveStunTrigger(state, []) : applyWishEffect(state, undefined, 1, []);
    expect(result.enemyHealth).toBe(94);
    expect(result.enemyMitigation.armor).toBe(2);
  });

  it("Icy Heart receives the damage bonus against the enemy it just Froze", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { freeze: 100 },
      trinketEffects: { frozenHeartDamage: 6 },
      gearEffects: { frozenEnemyDamageBonusPercent: 50 },
    });
    expect(tryTriggerEnemyFreeze(state, state, []).enemyHealth).toBe(91);
  });

  it("rejects a damaged Mixed Potion cost instead of playing it for free", () => {
    const potion = createMixedPotion(cardById["health-potion"]!, cardById["mana-potion"]!);
    const card = { ...potion, cost: -1 };
    const state = patchBattleState({ hand: [card], mana: 0, playerHealth: 10 });
    expect(canPlayCard(state, card, 0)).toBe(false);
    expect(playBattleCardResolved(state, card.id, 0).state).toBe(state);
    const valid = makeTestCard({ cost: 0 });
    expect(canPlayCard({ ...state, hand: [valid] }, valid, 0)).toBe(true);
  });
});
