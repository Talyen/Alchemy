import type { EnemyAttackEffect } from "@/lib/game-data";
import { BATTLE_CONFIG } from "../game-constants";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { mergeCombatText } from "./combat-text-events";
import { computeLeechHeal } from "./damage-rider-leech";
import { scaleByRoomMultiplier } from "./enemy-turn-traits";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import { applyHealthLossTalentRewards } from "./status-player";
import type { BattleState, CombatTextEvent } from "./types";
import { applyPlayerCombatDamage, isPlayerDefeated, playerHealthLostToDamage } from "./health-state";
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

type EnemyMitigationResult = ReturnType<typeof calculateBlockAndArmorMitigation>;

function spendEnemyForgeForHit(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  landed: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  const forgeBasedBurn = effect.damageType === "burn" && "equalToForge" in effect && effect.equalToForge === true;
  if (
    !landed ||
    hasEnemyTrait(state, "whitehot") ||
    (effect.damageType !== "physical" && effect.damageType !== "stun" && !forgeBasedBurn) ||
    state.enemyMitigation.forge <= 0
  ) {
    return state;
  }
  const spent = Math.min(state.enemyMitigation.forge, BATTLE_CONFIG.FORGE_DECAY_AMOUNT);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "forge", amount: spent, impact: false });
  return {
    ...state,
    enemyMitigation: { ...state.enemyMitigation, forge: state.enemyMitigation.forge - spent },
  };
}

interface EnemyHitFacts {
  readonly before: BattleState;
  readonly mitigation: EnemyMitigationResult;
  readonly blockLost: number;
  readonly outcome: Omit<EnemyDamageResult, "state">;
}

function applyEnemyHealthHit(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  attemptedDamage: number,
  mitigation: EnemyMitigationResult,
  combatTexts: CombatTextEvent[],
): { state: BattleState; facts: EnemyHitFacts } {
  const { actualDamage, totalExtraBlock, blockSpent } = mitigation;
  let attackState = state;
  if (totalExtraBlock > 0) {
    if (effect.damageType === "physical" && hasEnemyTrait(state, "ogre"))
      attackState = recordEnemyAbilityActivation(attackState, "ogre");
    if (effect.damageType === "poison" && hasEnemyTrait(state, "giant-snake"))
      attackState = recordEnemyAbilityActivation(attackState, "giant-snake");
  }
  const damagedState = applyPlayerCombatDamage(
    attackState,
    actualDamage,
    "hostile",
    effect.damageType,
    { ignoreMitigation: true },
    combatTexts,
  );
  const blockLost = Math.min(blockSpent + totalExtraBlock, damagedState.playerStatuses.block);
  const outcome = {
    blockLost,
    healthAfterHit: damagedState.playerHealth,
    healthDamage: playerHealthLostToDamage(state, damagedState),
    attemptedDamage,
    resolvedDamage: actualDamage,
    landed: attemptedDamage > 0,
    dodged: false,
    killed: !isPlayerDefeated(state) && isPlayerDefeated(damagedState),
  };
  const nextState: BattleState = {
    ...damagedState,
    playerStatuses: {
      ...damagedState.playerStatuses,
      block: Math.max(0, damagedState.playerStatuses.block - blockLost),
    },
  };

  return { state: nextState, facts: { before: state, mitigation, blockLost, outcome } };
}

function applyEnemyHitLeech(
  nextState: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  facts: EnemyHitFacts,
  combatTexts: CombatTextEvent[],
): BattleState {
  const {
    before: state,
    outcome: { resolvedDamage: actualDamage, healthDamage },
  } = facts;
  if (effect.lifesteal && actualDamage > 0) {
    const healthLost = hasEnemyTrait(state, "ravenous") ? healthDamage : actualDamage;
    nextState = applyEnemyLeechHealing(nextState, healthLost, combatTexts);
    if (effect.damageType === "bleed") {
      nextState = {
        ...nextState,
        pendingEnemyBleedLeechHealing:
          nextState.pendingEnemyBleedLeechHealing +
          Math.max(0, nextState.playerStatuses.bleed - state.playerStatuses.bleed),
      };
    }
  }

  return nextState;
}

function resolveEnemyDamageEffectCore(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
  options: EnemyDamageOptions = {},
): EnemyDamageResult {
  if (state.playerHealth <= 0)
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
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: preDamageBlockStrip });

  const mitigation = calculateBlockAndArmorMitigation(hitState, effect, incomingDamage, combatTexts, options, state);

  const hit = applyEnemyHealthHit(hitState, effect, attemptedDamage, mitigation, combatTexts);
  const { facts } = hit;
  const { blockLost, outcome } = facts;
  const attackBlockLost = blockLost + preDamageBlockStrip;
  const isBlockDepleted = state.playerStatuses.block > 0 && attackBlockLost >= state.playerStatuses.block;
  // Capture Health loss before threshold healing, then resolve retaliation only for survivors.
  let nextState = applyPlayerDefensiveReactions(
    spendEnemyForgeForHit(hit.state, effect, outcome.landed, combatTexts),
    effect,
    { ...facts, preDamageBlockStrip, attackBlockLost, isBlockDepleted },
    combatTexts,
    state,
  );
  nextState = applyHealthLossTalentRewards(hitState, nextState, outcome.healthDamage, combatTexts);

  const fullOutcome = { ...outcome, blockLost: outcome.blockLost + preDamageBlockStrip };
  if (nextState.enemyHealth <= 0 || nextState.playerHealth <= 0) return { state: nextState, ...fullOutcome };

  nextState = resolvePlayerCrowdControlTriggers(nextState, combatTexts);

  nextState = applyEnemyHitLeech(nextState, effect, facts, combatTexts);

  if (attackBlockLost > 0 && options.triggerBlockRetaliation) {
    nextState = applyBlockedAttackRetaliation(nextState, attackBlockLost, combatTexts, isBlockDepleted);
  }

  if (nextState.enemyHealth <= 0 || nextState.playerHealth <= 0) return { state: nextState, ...fullOutcome };

  if (!options.skipTraitReactions) {
    const traitSet = options.traitSet ?? getEnemyTraitSet(nextState);
    if (
      hasEnemyTrait(nextState, "earth-elemental", traitSet) &&
      state.playerStatuses.block > 0 &&
      attackBlockLost >= state.playerStatuses.block &&
      nextState.playerHealth > 0
    ) {
      nextState = processEnemyDamageEffect(
        nextState,
        { kind: "damage", damageType: "physical", amount: scaleByRoomMultiplier(nextState, 1) },
        combatTexts,
        { skipTraitReactions: true, traitSet },
      );
    }
  }

  return { state: nextState, ...fullOutcome };
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
