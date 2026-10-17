import type { EnemyAttackEffect } from "@/lib/game-data";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { mergeCombatText } from "./combat-text-events";
import { computeLeechHeal } from "./damage-rider-leech";
import { scaleByRoomMultiplier } from "./enemy-turn-traits";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import type { BattleState, CombatTextEvent } from "./types";
import { applyPlayerCombatDamage, playerHealthLostToDamage } from "./health-state";
import { isPlayerDefeated } from "./battle-outcome";
import { getEnemyTraitSet, hasEnemyTrait } from "./encounter-trait-state";

import { applyBlockedAttackRetaliation, applyPlayerDefensiveReactions } from "./player-defensive-reactions";
import {
  calculateBlockAndArmorMitigation,
  prepareEnemyDamage,
  type EnemyDamageOptions,
} from "./enemy-damage-mitigation";

export { prepareEnemyDamage, type EnemyDamageOptions } from "./enemy-damage-mitigation";

export function applyEnemyLeechHealing(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const healAmount = computeLeechHeal(actualDamage);
  if (healAmount <= 0) return state;
  return applyEnemyHealingWithCombatText(state, healAmount, combatTexts, { skipFightPacing: true });
}

export interface EnemyDamageResult {
  state: BattleState;
  /** Magnitude before defensive reductions; determines contact independently of Health loss. */
  attemptedDamage: number;
  /** Damage after defenses, before Health clamping and death prevention. */
  resolvedDamage: number;
  healthDamage: number;
  /** Hit outcomes before defensive rewards refill Block or restore Health. */
  blockLost: number;
  healthAfterHit: number;
  landed: boolean;
  dodged: boolean;
  killed: boolean;
}

function resolveEnemyDamageEffectCore(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
  options: EnemyDamageOptions = {},
): EnemyDamageResult {
  if (state.playerHealth <= 0 || state.enemyHealth <= 0)
    return {
      state,
      attemptedDamage: 0,
      resolvedDamage: 0,
      healthDamage: 0,
      blockLost: 0,
      healthAfterHit: state.playerHealth,
      landed: false,
      dodged: false,
      killed: false,
    };
  const { attemptedDamage, incomingDamage } = options.preparedDamage ?? prepareEnemyDamage(state, effect, options);
  const preDamageBlockStrip =
    attemptedDamage > 0 ? Math.min(state.playerStatuses.block, options.preDamageBlockStrip ?? 0) : 0;
  const hitState =
    preDamageBlockStrip > 0
      ? {
          ...state,
          playerStatuses: { ...state.playerStatuses, block: state.playerStatuses.block - preDamageBlockStrip },
        }
      : state;
  if (preDamageBlockStrip > 0)
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: "block",
      amount: preDamageBlockStrip,
      impact: false,
    });

  const mitigation = calculateBlockAndArmorMitigation(hitState, effect, incomingDamage, combatTexts, options, state);

  let attackState = hitState;
  if (mitigation.totalExtraBlock > 0) {
    if (effect.damageType === "physical" && hasEnemyTrait(state, "ogre"))
      attackState = recordEnemyAbilityActivation(attackState, "ogre");
    if (effect.damageType === "poison" && hasEnemyTrait(state, "giant-snake"))
      attackState = recordEnemyAbilityActivation(attackState, "giant-snake");
  }
  const damaged = applyPlayerCombatDamage(
    attackState,
    mitigation.actualDamage,
    "hostile",
    effect.damageType,
    { ignoreMitigation: true },
    combatTexts,
  );
  const blockLost = Math.min(mitigation.blockSpent + mitigation.totalExtraBlock, hitState.playerStatuses.block);
  const attackBlockLost = blockLost + preDamageBlockStrip;
  const isBlockDepleted = state.playerStatuses.block > 0 && attackBlockLost >= state.playerStatuses.block;
  // Capture the hit before defensive rewards restore Health or refill Block.
  const outcome = {
    attemptedDamage,
    resolvedDamage: mitigation.actualDamage,
    healthDamage: playerHealthLostToDamage(state, damaged),
    healthAfterHit: damaged.playerHealth,
    blockLost: attackBlockLost,
    landed: attemptedDamage > 0,
    dodged: false,
    killed: !isPlayerDefeated(state) && isPlayerDefeated(damaged),
  };
  let nextState = applyPlayerDefensiveReactions(
    { ...damaged, playerStatuses: { ...damaged.playerStatuses, block: hitState.playerStatuses.block - blockLost } },
    effect,
    { before: state, mitigation, isBlockDepleted },
    combatTexts,
    resolvePendingBattleReactions,
  );
  if (nextState.enemyHealth <= 0 || nextState.playerHealth <= 0) return { state: nextState, ...outcome };

  nextState = resolvePlayerCrowdControlTriggers(nextState, combatTexts);
  if (effect.lifesteal && mitigation.actualDamage > 0) {
    nextState = applyEnemyLeechHealing(
      nextState,
      hasEnemyTrait(state, "ravenous") ? outcome.healthDamage : mitigation.actualDamage,
      combatTexts,
    );
    if (effect.damageType === "bleed") {
      nextState = {
        ...nextState,
        pendingEnemyBleedLeechHealing:
          nextState.pendingEnemyBleedLeechHealing +
          Math.max(0, nextState.playerStatuses.bleed - state.playerStatuses.bleed),
      };
    }
  }

  if (attackBlockLost > 0 && options.triggerBlockRetaliation) {
    nextState = applyBlockedAttackRetaliation(nextState, attackBlockLost, combatTexts, isBlockDepleted);
  }

  if (nextState.enemyHealth <= 0 || nextState.playerHealth <= 0) return { state: nextState, ...outcome };

  if (!options.skipTraitReactions) {
    const traitSet = options.traitSet ?? getEnemyTraitSet(nextState);
    if (hasEnemyTrait(nextState, "earth-elemental", traitSet) && isBlockDepleted) {
      nextState = processEnemyDamageEffect(
        nextState,
        { kind: "damage", damageType: "physical", amount: scaleByRoomMultiplier(nextState, 1) },
        combatTexts,
        { skipTraitReactions: true, traitSet },
      );
    }
  }

  return { state: nextState, ...outcome };
}

function resolvePendingCinderSkinReaction(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (!state.flags.pendingCinderSkinReaction) return state;
  const ready = {
    ...state,
    flags: { ...state.flags, cinderSkinUsedThisTurn: true, pendingCinderSkinReaction: false },
  };
  if (ready.enemyHealth <= 0) return ready;
  return resolveEnemyDamageEffectCore(
    recordEnemyAbilityActivation(ready, "cinder-skin"),
    { kind: "damage", damageType: "burn", amount: scaleByRoomMultiplier(ready, 1) },
    combatTexts,
  ).state;
}

function resolvePendingEmberwakeDamage(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (!state.flags.pendingEmberwakeDamage) return state;
  const ready = { ...state, flags: { ...state.flags, pendingEmberwakeDamage: false } };
  if (ready.enemyHealth <= 0) return ready;
  return resolveFollowUpHit(
    ready,
    { source: "player-follow-up", damageType: "burn", amount: ready.gearEffects.burnOnDeathsDoorEntry },
    combatTexts,
  );
}

export function resolvePendingBattleReactions(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  while (nextState.flags.pendingCinderSkinReaction || nextState.flags.pendingEmberwakeDamage) {
    nextState = resolvePendingCinderSkinReaction(nextState, combatTexts);
    nextState = resolvePendingEmberwakeDamage(nextState, combatTexts);
  }
  return nextState;
}

export function resolveEnemyDamageEffect(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
  options: EnemyDamageOptions = {},
): EnemyDamageResult {
  const result = resolveEnemyDamageEffectCore(state, effect, combatTexts, options);
  return { ...result, state: resolvePendingBattleReactions(result.state, combatTexts) };
}

export function processEnemyDamageEffect(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
  options: EnemyDamageOptions = {},
): BattleState {
  return resolveEnemyDamageEffect(state, effect, combatTexts, options).state;
}
