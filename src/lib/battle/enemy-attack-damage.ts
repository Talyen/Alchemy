import type { EnemyAttackEffect } from "@/lib/game-data";
import { HALF_DIVISOR, LABYRINTH_MODIFIER_CONFIG, PERCENT_DENOMINATOR } from "../game-constants";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { applyEnemyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { computeLeechHeal } from "./damage-rider-leech";
import { isFreezeActiveForAspect, scaleByRoomMultiplier } from "./enemy-turn-traits";
import { paceCombatDamage } from "./fight-pacing";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import { armorMitigatesElementalDamage, reduceDamageByMana } from "./status-helpers";
import { applyForgeThresholdRewards, applyHealthLossTalentRewards } from "./status-player";
import {
  applyPlayerCombatDamage,
  isPlayerDefeated,
  mitigatePlayerCombatDamage,
  scaleReceivedPlayerDamage,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { getEnemyTraitSet, hasEnemyTrait } from "./types/state-helpers";

import { applyBlockedAttackRetaliation, applyPlayerDefensiveReactions } from "./player-defensive-reactions";

function applyEnemyAttackBonuses(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  const forge = effect.damageType === "physical" || effect.damageType === "stun" ? state.enemyMitigation.forge : 0;
  const physicalBonus = effect.damageType === "physical" ? state.enemyPhysicalDamageBonus : 0;
  return effect.amount + forge + physicalBonus;
}

function blockAbsorptionMultiplier(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  if (effect.damageType === "physical" && state.talentEffects.blockAbsorbPhysicalBonus > 0) {
    return 1 + state.talentEffects.blockAbsorbPhysicalBonus / PERCENT_DENOMINATOR;
  }
  return 1;
}

export interface EnemyDamageOptions {
  triggerBlockRetaliation?: boolean;
  amountMultiplier?: number;
  flatBonus?: number;
  ignorePlayerMitigation?: boolean;
  ignoreArmor?: boolean;
  ignoreBlock?: boolean;
  physicalBlockBreakMultiplier?: number;
  extraPoisonBlockStrip?: number;
  skipTraitReactions?: boolean;
  preparedDamage?: { attemptedDamage: number; incomingDamage: number };
  traitSet?: ReadonlySet<string>;
}

function computeMitigatedDamage(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  remainingDamage: number,
  ignorePlayerMitigation: boolean,
  ignoreArmor: boolean,
) {
  const armorMitigatesDamage =
    effect.damageType === "physical" ||
    effect.damageType === "stun" ||
    armorMitigatesElementalDamage(state, effect.damageType);
  const rawDamage =
    armorMitigatesDamage && !ignoreArmor ? Math.max(0, remainingDamage - state.playerStatuses.armor) : remainingDamage;
  const scaledDamage = ignorePlayerMitigation
    ? rawDamage
    : scaleReceivedPlayerDamage(rawDamage, state.talentEffects, effect.damageType);
  return mitigatePlayerCombatDamage(state, scaledDamage, effect.damageType, {
    ignoreMitigation: ignorePlayerMitigation,
  });
}

export function prepareEnemyDamage(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  options: EnemyDamageOptions = {},
) {
  const baseDamage = applyEnemyAttackBonuses(state, effect);
  const elementalBonus =
    effect.damageType === "burn"
      ? state.enemyStatuses.burnBonus
      : effect.damageType === "freeze"
        ? state.enemyStatuses.freezeBonus
        : 0;
  const scale = (amount: number) => {
    let damage = Math.max(0, amount + (options.flatBonus ?? 0)) * (options.amountMultiplier ?? 1);
    if (
      effect.damageType === "physical" &&
      hasEnemyTrait(state, "executioner") &&
      state.enemyHealth < state.enemyMaxHealth / HALF_DIVISOR
    )
      damage *= LABYRINTH_MODIFIER_CONFIG.double;
    return Math.round(paceCombatDamage(state, damage, "enemy"));
  };
  const attemptedDamage = scale(baseDamage + elementalBonus);
  const reduction = options.ignorePlayerMitigation
    ? 0
    : state.enemyStatuses.poison > 0
      ? state.talentEffects.poisonReducesEnemyDamage
      : 0;
  const manaMitigated = options.ignorePlayerMitigation ? attemptedDamage : reduceDamageByMana(state, attemptedDamage);
  return { attemptedDamage, incomingDamage: Math.max(0, manaMitigated - reduction) };
}

function calculateBlockAndArmorMitigation(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  incomingDamage: number,
  combatTexts: CombatTextEvent[],
  options: EnemyDamageOptions,
) {
  let remainingDamage = incomingDamage;
  const blockMultiplier = blockAbsorptionMultiplier(state, effect);
  const effectiveBlock =
    options.ignorePlayerMitigation || options.ignoreBlock
      ? 0
      : Math.round(state.playerStatuses.block * blockMultiplier);
  const blockAbsorb = Math.min(remainingDamage, effectiveBlock);
  const blockSpent =
    blockAbsorb <= 0
      ? 0
      : blockAbsorb === effectiveBlock
        ? state.playerStatuses.block
        : Math.min(state.playerStatuses.block, Math.round(blockAbsorb / blockMultiplier));
  remainingDamage -= blockAbsorb;
  if (blockSpent > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockSpent });
  }
  const remainingBlock = Math.max(0, state.playerStatuses.block - blockSpent);
  const extraPhysicalBlock =
    !options.ignoreBlock && effect.damageType === "physical" && (options.physicalBlockBreakMultiplier ?? 1) > 1
      ? Math.min(remainingBlock, Math.round(blockSpent * ((options.physicalBlockBreakMultiplier ?? 1) - 1)))
      : 0;
  const extraPoisonBlock =
    !options.ignoreBlock && effect.damageType === "poison" && !options.ignorePlayerMitigation
      ? Math.min(remainingBlock, options.extraPoisonBlockStrip ?? 0)
      : 0;
  const totalExtraBlock = Math.max(extraPhysicalBlock, extraPoisonBlock);
  if (totalExtraBlock > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: totalExtraBlock });
  }
  const actualDamage = computeMitigatedDamage(
    state,
    effect,
    remainingDamage,
    options.ignorePlayerMitigation === true,
    options.ignoreArmor === true,
  );
  return { remainingDamage, blockAbsorb, blockSpent, totalExtraBlock, actualDamage };
}

export function applyEnemyLeechHealing(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (isFreezeActiveForAspect(state, "regen")) return state;
  if (state.talentEffects.blockEnemyLeech) return state;
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
  const prevHealth = state.playerHealth;
  const damagedState = applyPlayerCombatDamage(
    attackState,
    actualDamage,
    "hostile",
    effect.damageType,
    { ignoreMitigation: true },
    combatTexts,
  );
  const blockLost = Math.min(blockSpent + totalExtraBlock, damagedState.playerStatuses.block);
  // Recovery does not cancel Health damage already dealt by the lethal hit.
  const phoenixTriggered = state.playerStatuses.phoenixFeather > 0 && damagedState.playerStatuses.phoenixFeather === 0;
  const outcome = {
    blockLost,
    healthAfterHit: damagedState.playerHealth,
    healthDamage: phoenixTriggered ? prevHealth : Math.max(0, prevHealth - damagedState.playerHealth),
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

  const mitigation = calculateBlockAndArmorMitigation(state, effect, incomingDamage, combatTexts, options);

  const hit = applyEnemyHealthHit(state, effect, attemptedDamage, mitigation, combatTexts);
  const { facts } = hit;
  const { blockLost, outcome } = facts;
  // Capture Health loss before threshold healing, then resolve retaliation only for survivors.
  let nextState = applyPlayerDefensiveReactions(hit.state, effect, facts, combatTexts);
  nextState = applyHealthLossTalentRewards(state, nextState, outcome.healthDamage, combatTexts);

  if (nextState.enemyHealth <= 0 || nextState.playerHealth <= 0) return { state: nextState, ...outcome };

  nextState = resolvePlayerCrowdControlTriggers(nextState, combatTexts);

  nextState = applyEnemyHitLeech(nextState, effect, facts, combatTexts);

  if (mitigation.blockAbsorb > 0 && options.triggerBlockRetaliation) {
    nextState = applyBlockedAttackRetaliation(
      nextState,
      blockLost,
      combatTexts,
      blockLost > 0 && blockLost >= state.playerStatuses.block,
    );
  }

  if (nextState.enemyHealth <= 0 || nextState.playerHealth <= 0) return { state: nextState, ...outcome };

  if (!options.skipTraitReactions) {
    const traitSet = options.traitSet ?? getEnemyTraitSet(nextState);
    if (
      hasEnemyTrait(nextState, "earth-elemental", traitSet) &&
      state.playerStatuses.block > 0 &&
      blockLost >= state.playerStatuses.block &&
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

  return { state: nextState, ...outcome };
}

function resolvePendingCinderSkinReaction(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (!state.flags.pendingCinderSkinReaction) return state;
  const ready = {
    ...state,
    flags: { ...state.flags, cinderSkinUsedThisTurn: true, pendingCinderSkinReaction: false },
  };
  return resolveEnemyDamageEffectCore(
    recordEnemyAbilityActivation(ready, "cinder-skin"),
    { kind: "damage", damageType: "burn", amount: scaleByRoomMultiplier(ready, 1) },
    combatTexts,
  ).state;
}

export function resolvePendingBattleReactions(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  while (nextState.pendingForgeThresholds.length > 0 || nextState.flags.pendingCinderSkinReaction) {
    const thresholds = nextState.pendingForgeThresholds;
    if (thresholds.length > 0) {
      nextState = { ...nextState, pendingForgeThresholds: [] };
      for (const { previousForge, nextForge } of thresholds) {
        nextState = applyForgeThresholdRewards(nextState, previousForge, nextForge, combatTexts);
      }
    }
    nextState = resolvePendingCinderSkinReaction(nextState, combatTexts);
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
