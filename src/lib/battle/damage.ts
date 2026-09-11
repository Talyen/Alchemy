import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { UNIQUE_GEAR_COMBAT } from "../game-constants";
import { computeCardDamageToEnemy } from "./damage-calc";
import { applyDamageRiders } from "./damage-riders";
import { addGoldWithCombatText } from "./combat-text";
import { tryDodgePlayerAttackPacket } from "./dodge";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { applyEncounterThorns } from "./encounter-trait-events";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { dealPlayerTypedHit, dealTalentTypedHit } from "./player-typed-hit";
import type { BattleState, CombatTextEvent } from "./types";

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
  const bonuses = { flat: 0, physical: 0, bleed: 0, sanguine: 0, ...context?.attackBonuses };
  bonuses.physical += bonuses.sanguine;
  if (bonuses.sanguine > 0) {
    state = { ...state, flags: { ...state.flags, sanguinePhysicalBonus: 0 } };
  }
  if (context?.attackBonuses) {
    context.attackBonuses.flat = 0;
    context.attackBonuses.physical = 0;
    context.attackBonuses.bleed = 0;
    context.attackBonuses.sanguine = 0;
  }
  const dodged = tryDodgePlayerAttackPacket(state, combatTexts);
  if (dodged) {
    return dodged;
  }

  const convertToPoison = state.flags.nextHitPoison;
  const packet = convertToPoison ? { ...effect, damageType: "poison" as const } : effect;
  let damageState = convertToPoison ? { ...state, flags: { ...state.flags, nextHitPoison: false } } : state;

  if (packet.damageType === "physical" && damageState.flags.nextHitPhysicalBonus > 0) {
    bonuses.physical += damageState.flags.nextHitPhysicalBonus;
    damageState = {
      ...damageState,
      flags: { ...damageState.flags, nextHitPhysicalBonus: 0 },
    };
  }

  const applyPartingCut = packet.damageType === "physical" && damageState.flags.nextPhysicalDealsBleed;
  if (applyPartingCut) {
    damageState = { ...damageState, flags: { ...damageState.flags, nextPhysicalDealsBleed: false } };
  }

  const { nextState, modifiedDamage } = computeCardDamageToEnemy(damageState, packet, card, {
    manaAtStart: damageState.mana,
    enemyFreezeSkipTurnsAtStart: damageState.enemyCC.freezeSkipTurns,
    ...context,
    baseDamageBonus:
      bonuses.flat +
      (packet.damageType === "physical" ? bonuses.physical : 0) +
      (packet.damageType === "bleed" ? bonuses.bleed : 0),
  });
  const viper =
    context?.playedCard &&
    packet.damageType === "physical" &&
    modifiedDamage > 0 &&
    damageState.gearEffects.dodgeReadiesVenomousHit > 0 &&
    damageState.uniqueGear.viperReady;
  const afterViper = viper ? { ...nextState, uniqueGear: { ...nextState.uniqueGear, viperReady: false } } : nextState;
  let result = applyDamageRiders(afterViper, card, packet, modifiedDamage, combatTexts, {
    cardHealing: context?.cardHealing,
    companionAttack: context?.companionAttack,
    onDamageDealt: context?.onDamageDealt,
  });
  if (viper && result.enemyHealth > 0) {
    const venomDamage = Math.round(modifiedDamage * UNIQUE_GEAR_COMBAT.viperDamageMultiplier);
    result = dealPlayerTypedHit(result, "poison", venomDamage, combatTexts);
    result = dealPlayerTypedHit(result, "bleed", venomDamage, combatTexts);
  }
  if (applyPartingCut && modifiedDamage > 0 && result.enemyHealth > 0) {
    result = dealTalentTypedHit(result, "bleed", modifiedDamage, combatTexts, true);
  }
  if (modifiedDamage > 0 && result.enemyHealth > 0) {
    if (packet.damageType !== "physical" && bonuses.physical > 0) {
      result = dealPlayerTypedHit(result, "physical", bonuses.physical, combatTexts);
    }
    if (packet.damageType !== "bleed" && bonuses.bleed > 0) {
      result = dealPlayerTypedHit(result, "bleed", bonuses.bleed, combatTexts);
    }
  }
  // Award once after the whole attack packet, including its secondary hits.
  if (result.enemyHealth <= 0 && card.tags?.includes("archery") && result.talentEffects.goldOnArcheryKill > 0) {
    result = addGoldWithCombatText(result, result.talentEffects.goldOnArcheryKill, combatTexts);
  }
  return resolvePendingBattleReactions(applyEncounterThorns(result, combatTexts), combatTexts);
}
