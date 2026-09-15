import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { UNIQUE_GEAR_COMBAT } from "../game-constants";
import { addGoldWithCombatText } from "./combat-text";
import { computeCardDamageToEnemy } from "./damage-calc";
import { applyDamageRiders } from "./damage-riders";
import { tryDodgePlayerAttackPacket } from "./dodge";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { applyEncounterThorns } from "./encounter-trait-events";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { dealPlayerTypedHit, dealTalentTypedHit } from "./player-typed-hit";
import type { BattleState, CombatTextEvent } from "./types";

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

interface AttackPacket {
  packet: DamageEffect;
  /** Flat amount the caller adds to the physical follow-up bonus. */
  physicalBonus: number;
  applyPartingCut: boolean;
}

// Single owner for per-hit flag consumption. It runs after the dodge
// early-return in dealDamageToEnemy, so a dodged attack preserves every
// flag consumed here (matching the leech/poison comment below).
function consumeAttackPacketFlags(state: BattleState, effect: DamageEffect): { state: BattleState } & AttackPacket {
  const convertToPoison = state.flags.nextHitPoison;
  const poisonPacket = convertToPoison ? { ...effect, damageType: "poison" as const } : effect;
  let damageState = convertToPoison ? { ...state, flags: { ...state.flags, nextHitPoison: false } } : state;

  // Predator's Focus grants Leech on the next damaging card. Consume the flag
  // here so dodge preserves it (early return above) while companion and
  // delayed pulses cannot observe it (withPreservedFlags forces it false).
  const leechNext = damageState.flags.nextHitLeech;
  const packet = leechNext ? { ...poisonPacket, lifesteal: true as const } : poisonPacket;
  if (leechNext) {
    damageState = { ...damageState, flags: { ...damageState.flags, nextHitLeech: false } };
  }

  let physicalBonus = 0;
  if (damageState.flags.nextHitPhysicalBonus > 0) {
    physicalBonus = damageState.flags.nextHitPhysicalBonus;
    damageState = {
      ...damageState,
      flags: { ...damageState.flags, nextHitPhysicalBonus: 0 },
    };
  }

  const applyPartingCut = packet.damageType === "physical" && damageState.flags.nextPhysicalDealsBleed;
  if (applyPartingCut) {
    damageState = { ...damageState, flags: { ...damageState.flags, nextPhysicalDealsBleed: false } };
  }
  return { state: damageState, packet, physicalBonus, applyPartingCut };
}

function applyAttackPacketFollowUps(
  result: BattleState,
  damageType: Extract<BattleCardEffect, { kind: "damage" }>["damageType"],
  modifiedDamage: number,
  bonuses: { physical: number; bleed: number },
  viper: boolean,
  applyPartingCut: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (viper && result.enemyHealth > 0) {
    const venomDamage = Math.round(modifiedDamage * UNIQUE_GEAR_COMBAT.viperDamageMultiplier);
    result = dealPlayerTypedHit(result, "poison", venomDamage, combatTexts);
    result = dealPlayerTypedHit(result, "bleed", venomDamage, combatTexts);
  }
  if (applyPartingCut && modifiedDamage > 0 && result.enemyHealth > 0) {
    result = dealTalentTypedHit(result, "bleed", modifiedDamage, combatTexts, true);
  }
  if (modifiedDamage > 0 && result.enemyHealth > 0) {
    if (damageType !== "physical" && bonuses.physical > 0) {
      result = dealPlayerTypedHit(result, "physical", bonuses.physical, combatTexts);
    }
    if (damageType !== "bleed" && bonuses.bleed > 0) {
      result = dealPlayerTypedHit(result, "bleed", bonuses.bleed, combatTexts);
    }
  }
  return result;
}

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

  const consumed = consumeAttackPacketFlags(state, effect);
  const { packet, applyPartingCut } = consumed;
  const damageState = consumed.state;
  bonuses.physical += consumed.physicalBonus;

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
  result = applyAttackPacketFollowUps(
    result,
    packet.damageType,
    modifiedDamage,
    bonuses,
    Boolean(viper),
    applyPartingCut,
    combatTexts,
  );
  // Award once after the whole attack packet, including its secondary hits.
  if (result.enemyHealth <= 0 && card.tags?.includes("archery") && result.talentEffects.goldOnArcheryKill > 0) {
    result = addGoldWithCombatText(result, result.talentEffects.goldOnArcheryKill, combatTexts);
  }
  return resolvePendingBattleReactions(applyEncounterThorns(result, combatTexts), combatTexts);
}
