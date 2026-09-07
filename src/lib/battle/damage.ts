import { applyEncounterThorns } from "./encounter-trait-events";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { UNIQUE_GEAR_COMBAT } from "../game-constants";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { computeCardDamageToEnemy } from "./damage-calc";
import { applyDamageRiders } from "./damage-riders";
import { tryDodgePlayerAttackPacket } from "./dodge";
import { dealPlayerTypedHit } from "./player-typed-hit";

export function dealDamageToEnemy(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  combatTexts: CombatTextEvent[],
  context?: CardEffectResolutionContext,
) {
  if (state.enemyHealth <= 0 || state.playerHealth <= 0) return state;
  const { damageTypePool: _pool, ...resolvedEffect } = effect;
  context?.damageEffects?.push(resolvedEffect);
  const dodged = tryDodgePlayerAttackPacket(state, combatTexts);
  if (dodged) {
    return dodged;
  }

  const convertToPoison = state.flags.nextHitPoison;
  const activeEffect = convertToPoison ? { ...effect, damageType: "poison" as const } : effect;
  let damageState = convertToPoison ? { ...state, flags: { ...state.flags, nextHitPoison: false } } : state;

  let packet = activeEffect;
  if (packet.damageType === "physical" && damageState.flags.nextHitPhysicalBonus > 0) {
    packet = { ...packet, amount: packet.amount + damageState.flags.nextHitPhysicalBonus };
    damageState = {
      ...damageState,
      flags: { ...damageState.flags, nextHitPhysicalBonus: 0 },
    };
  }

  const applyPartingCut = packet.damageType === "physical" && damageState.flags.nextPhysicalDealsBleed;
  if (applyPartingCut) {
    damageState = { ...damageState, flags: { ...damageState.flags, nextPhysicalDealsBleed: false } };
  }

  const { nextState, modifiedDamage } = computeCardDamageToEnemy(damageState, packet, card, context);
  const viper =
    context?.playedCard &&
    packet.damageType === "physical" &&
    modifiedDamage > 0 &&
    damageState.gearEffects.dodgeReadiesVenomousHit > 0 &&
    damageState.uniqueGear.viperReady;
  const afterViper = viper ? { ...nextState, uniqueGear: { ...nextState.uniqueGear, viperReady: false } } : nextState;
  let result = applyDamageRiders(afterViper, card, packet, modifiedDamage, combatTexts);
  if (viper && result.enemyHealth > 0) {
    const venomDamage = Math.round(modifiedDamage * UNIQUE_GEAR_COMBAT.viperDamageMultiplier);
    result = dealPlayerTypedHit(result, "poison", venomDamage, combatTexts);
    result = dealPlayerTypedHit(result, "bleed", venomDamage, combatTexts);
  }
  if (applyPartingCut && modifiedDamage > 0 && result.enemyHealth > 0) {
    result = dealPlayerTypedHit(result, "bleed", modifiedDamage, combatTexts);
  }
  return applyEncounterThorns(result, combatTexts);
}
