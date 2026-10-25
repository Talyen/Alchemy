import {
  applyShatter,
  applyElementalReactionDamage,
  getPostHitReactionPayoffs,
  canInitiateElementalReaction,
  canShatter,
} from "./elemental-reactions";
import { readCombatFlag, resolveSecondaryAction } from "./action-context";
import { scalePercent } from "./amount-helpers";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { UNIQUE_GEAR_COMBAT } from "../game-constants";
import { addGoldWithCombatText } from "./player-rewards";
import { computeCardAttackPower, computeCardDamageToEnemy } from "./damage-calc";
import { computeBaseDamage } from "./player-damage-base";
import { resolvePlayerHit } from "./hit-resolution";
import { tryDodgePlayerAttackPacket } from "./dodge";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { applyEncounterThorns } from "./encounter-trait-events";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import type { BattleState, CombatTextEvent } from "./types";
import { observeAttackPower } from "./resolution-observer";
import { isPlayerDefeated } from "./battle-outcome";

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

interface AttackPacket {
  packet: DamageEffect;
  /** Opening joins a Physical hit or supplies a separate Physical follow-up. */
  physicalBonus: number;
  stunBonus: number;
  applyPartingCut: boolean;
}

// Builds an immutable candidate; dealDamageToEnemy commits its flag changes
// only after establishing a positive attack and passing Dodge.
function consumeAttackPacketFlags(state: BattleState, effect: DamageEffect): { state: BattleState } & AttackPacket {
  const convertToPoison = readCombatFlag(state, "nextHitPoison");
  const poisonPacket = convertToPoison ? { ...effect, damageType: "poison" as const } : effect;
  let damageState = convertToPoison ? { ...state, flags: { ...state.flags, nextHitPoison: false } } : state;

  // Predator's Focus grants Leech on the next damaging card. Consume the flag
  // here so dodge preserves it (early return above) while companion and
  // delayed pulses are ineligible through their action scope.
  const leechNext = readCombatFlag(damageState, "nextHitLeech");
  const packet = leechNext ? { ...poisonPacket, lifesteal: true as const } : poisonPacket;
  if (leechNext) {
    damageState = { ...damageState, flags: { ...damageState.flags, nextHitLeech: false } };
  }

  const stunBonus = packet.damageType === "stun" ? readCombatFlag(damageState, "nextStunAttackBonus") : 0;
  if (stunBonus > 0) {
    damageState = { ...damageState, flags: { ...damageState.flags, nextStunAttackBonus: 0 } };
  }

  let physicalBonus = 0;
  if (readCombatFlag(damageState, "nextHitPhysicalBonus") > 0) {
    physicalBonus = readCombatFlag(damageState, "nextHitPhysicalBonus");
    damageState = {
      ...damageState,
      flags: { ...damageState.flags, nextHitPhysicalBonus: 0 },
    };
  }

  const applyPartingCut = packet.damageType === "physical" && readCombatFlag(damageState, "nextPhysicalDealsBleed");
  if (applyPartingCut) {
    damageState = { ...damageState, flags: { ...damageState.flags, nextPhysicalDealsBleed: false } };
  }
  return { state: damageState, packet, physicalBonus, stunBonus, applyPartingCut };
}

/** Shared immutable attack preparation; hosts retain their own admission and feedback. */
export function prepareAttackPacket(state: BattleState, effect: DamageEffect, companionBonus = 0) {
  const consumed = consumeAttackPacketFlags(state, effect);
  return {
    ...consumed,
    baseDamageBonus:
      companionBonus + consumed.stunBonus + (consumed.packet.damageType === "physical" ? consumed.physicalBonus : 0),
  };
}

function applyAttackPacketFollowUps(
  result: BattleState,
  damageType: Extract<BattleCardEffect, { kind: "damage" }>["damageType"],
  modifiedDamage: number,
  physicalBonus: number,
  viper: boolean,
  applyPartingCut: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (viper && result.enemyHealth > 0) {
    const venomDamage = Math.round(modifiedDamage * UNIQUE_GEAR_COMBAT.viperDamageMultiplier);
    result = resolveFollowUpHit(
      result,
      { source: "player-follow-up", damageType: "poison", amount: venomDamage },
      combatTexts,
    );
    result = resolveFollowUpHit(
      result,
      { source: "player-follow-up", damageType: "bleed", amount: venomDamage },
      combatTexts,
    );
  }
  if (applyPartingCut && modifiedDamage > 0 && result.enemyHealth > 0) {
    const copiedDamage =
      result.talentEffects.partingCutDamagePercent > 0
        ? scalePercent(modifiedDamage, result.talentEffects.partingCutDamagePercent)
        : modifiedDamage;
    result = resolveFollowUpHit(
      result,
      { source: "talent-derived", damageType: "bleed", amount: copiedDamage },
      combatTexts,
    );
  }
  if (modifiedDamage > 0 && result.enemyHealth > 0 && damageType !== "physical" && physicalBonus > 0) {
    result = resolveFollowUpHit(
      result,
      { source: "player-follow-up", damageType: "physical", amount: physicalBonus },
      combatTexts,
    );
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
  // Echoes are secondary actions, so capture the turn's earned sequence bonus
  // before their scope suppresses it. Other damage modifiers remain live.
  const sequenceBonus =
    card.tags?.includes("archery") && readCombatFlag(state, "archerySecondCardActive")
      ? state.talentEffects.archerySecondCardDamage
      : 0;
  const captureDamageEffect = (packet: DamageEffect) =>
    context?.damageEffects?.push({ ...packet, amount: packet.amount + sequenceBonus });
  // Attempt-scoped bonuses precede Dodge; next-hit bonuses are spent only on contact.
  const companionBonus = context?.companionAttackBonus?.amount ?? 0;
  if (context?.companionAttackBonus) context.companionAttackBonus.amount = 0;
  const consumed = prepareAttackPacket(state, resolvedEffect, companionBonus);
  const { packet, applyPartingCut } = consumed;
  const { baseDamageBonus } = consumed;
  const armorSuppliesDamage =
    packet.damageType === "stun" && state.gearEffects.armorIncreasesStun > 0 && state.enemyMitigation.armor > 0;
  if (
    !armorSuppliesDamage &&
    computeBaseDamage(consumed.state, packet, {
      card,
      bonus: baseDamageBonus,
      companionAttack: context?.origin === "companion",
    }) <= 0
  ) {
    observeAttackPower(state, packet, 0);
    return state;
  }
  const dodged = tryDodgePlayerAttackPacket(state, combatTexts, context?.feedback);
  if (dodged) {
    // A dodge deals no damage, so dodged packets stay out of the resolved
    // damage that Unique repeats and Archery echoes replay. The attempt still
    // counts for encounter reactions through the shared attempt cell.
    if (context?.attackAttempted) context.attackAttempted.value = true;
    return dodged;
  }

  captureDamageEffect(packet);
  const reactionEligible = canInitiateElementalReaction(state, context);
  const shatter =
    reactionEligible &&
    packet.damageType === "physical" &&
    canShatter(state) &&
    computeCardAttackPower(consumed.state, packet, card, { ...context, baseDamageBonus }).damage > 0;
  const shatterDamage = shatter ? state.reactions.shatterDamage : 0;
  const beforePurge = shatter ? applyShatter(consumed.state, combatTexts) : consumed.state;
  // Purge removes the defense before this hit can absorb into it. Its own
  // damage and retaliation may also end combat before mitigation starts.
  const damageState = resolvePendingBattleReactions(
    resolvePlayerHit(beforePurge, { source: "attack-purge" }, combatTexts),
    combatTexts,
  );
  if (damageState.enemyHealth <= 0 || isPlayerDefeated(damageState)) return damageState;

  if (state.observer) {
    const power = computeCardAttackPower(damageState, packet, card, { ...context, baseDamageBonus }, false).damage;
    const armorBonus =
      packet.damageType === "stun" && state.gearEffects.armorIncreasesStun > 0
        ? damageState.enemyMitigation.armor * (context?.damageMultiplier ?? 1)
        : 0;
    observeAttackPower(state, packet, power + armorBonus);
    if (packet.damageType !== "physical" && consumed.physicalBonus > 0 && power + armorBonus > 0) {
      resolveSecondaryAction(damageState, "reward", (secondary) => {
        const followUp = { kind: "damage" as const, damageType: "physical" as const, amount: consumed.physicalBonus };
        observeAttackPower(
          state,
          followUp,
          computeCardAttackPower(secondary, followUp, undefined, undefined, false).damage,
        );
        return secondary;
      });
    }
  }

  // Resolve magnitude and defenses before riders, follow-up hits, then reactions.
  const { nextState, modifiedDamage, critical } = computeCardDamageToEnemy(damageState, packet, card, {
    manaAtStart: damageState.mana,
    ...context,
    guaranteedCrit: context?.guaranteedCrit === true,
    baseDamageBonus,
  });
  const viper =
    context?.origin === "played-card" &&
    packet.damageType === "physical" &&
    modifiedDamage > 0 &&
    damageState.gearEffects.dodgeReadiesVenomousHit > 0 &&
    damageState.uniqueGear.viperReady;
  const afterViper = viper ? { ...nextState, uniqueGear: { ...nextState.uniqueGear, viperReady: false } } : nextState;
  let healthDamage = 0;
  let result = resolvePlayerHit(
    afterViper,
    {
      source: "card-attack",
      card,
      effect: packet,
      resolvedDamage: modifiedDamage,
      critical,
      origin: context?.origin,
      ...(context?.feedback ? { feedback: context.feedback } : {}),
      ...(context?.forgeTriggers ? { forgeTriggers: context.forgeTriggers } : {}),
      onDamageDealt: (amount) => {
        healthDamage = amount;
        context?.onDamageDealt?.(amount);
      },
    },
    combatTexts,
    resolvePendingBattleReactions,
  );
  if (isPlayerDefeated(result)) return result;
  const payoffs = reactionEligible ? getPostHitReactionPayoffs(state, result, packet.damageType, healthDamage) : [];
  if (
    reactionEligible &&
    packet.damageType === "holy" &&
    healthDamage > 0 &&
    state.enemyStatuses.bleed > 0 &&
    result.enemyStatuses.bleed > 0
  ) {
    result = { ...result, reactions: { ...result.reactions, consecrated: true } };
  }
  if (shatter) payoffs.unshift({ id: "shatter", damage: shatterDamage });
  result = applyAttackPacketFollowUps(
    result,
    packet.damageType,
    modifiedDamage,
    consumed.physicalBonus,
    viper,
    applyPartingCut,
    combatTexts,
  );
  result = resolvePendingBattleReactions(applyEncounterThorns(result, combatTexts), combatTexts);
  for (const payoff of payoffs) {
    result = resolvePendingBattleReactions(applyElementalReactionDamage(result, payoff, combatTexts), combatTexts);
  }
  // Attribute the entire packet, including reaction kills, to its Archery card exactly once.
  if (result.enemyHealth <= 0 && card.tags?.includes("archery") && result.talentEffects.goldOnArcheryKill > 0) {
    result = addGoldWithCombatText(result, result.talentEffects.goldOnArcheryKill, combatTexts);
    result = resolvePendingBattleReactions(result, combatTexts);
  }
  return result;
}
