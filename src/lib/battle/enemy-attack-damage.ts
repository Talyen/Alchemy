import { applyEnemyHealingWithCombatText, applyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { applyPlayerDamageStatuses, applyPlayerStatusEffect, shouldBlockPreventStunBuildup } from "./status-player";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import type { EnemyAttackEffect } from "@/lib/game-data";
import {
  applyPlayerCombatDamage,
  scaleReceivedPlayerDamage,
  type BattleState,
  type CombatTextEvent,
  type CombatTextStat,
} from "./types";
import { BATTLE_CONFIG, PERCENT_DENOMINATOR } from "../game-constants";
import { computeLeechHeal } from "./damage-rider-leech";
import { isFreezeActiveForAspect, scaleByRoomMultiplier } from "./enemy-turn-traits";
import { decayArmorAfterDamage } from "./status-helpers";
import { paceCombatMagnitude } from "./fight-pacing";
import { dealPlayerTypedHit } from "./player-typed-hit";
import { addEnemyMitigation, getEnemyTraitSet, hasEnemyTrait, setFlag } from "./types/state-helpers";

function applyPhysicalForgeBonus(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  if (effect.damageType !== "physical") return effect.amount;
  return effect.amount + state.enemyMitigation.forge + state.enemyPhysicalDamageBonus;
}

function computeEffectiveBlock(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  let effectiveBlock = state.playerStatuses.block;
  if (effect.damageType === "physical" && state.talentEffects.blockAbsorbPhysicalBonus > 0) {
    effectiveBlock = Math.round(
      effectiveBlock * (1 + state.talentEffects.blockAbsorbPhysicalBonus / PERCENT_DENOMINATOR),
    );
  }
  return effectiveBlock;
}

export interface EnemyDamageOptions {
  amountMultiplier?: number;
  flatBonus?: number;
  ignorePlayerMitigation?: boolean;
  physicalBlockBreakMultiplier?: number;
  extraPoisonBlockStrip?: number;
  skipTraitReactions?: boolean;
  incomingDamage?: number;
  traitSet?: ReadonlySet<string>;
}

function computeMitigatedDamage(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  remainingDamage: number,
  ignorePlayerMitigation: boolean,
) {
  const armorMitigatesDamage = effect.damageType === "physical" || effect.damageType === "stun";
  const rawDamage = armorMitigatesDamage ? Math.max(0, remainingDamage - state.playerStatuses.armor) : remainingDamage;
  return ignorePlayerMitigation
    ? rawDamage
    : scaleReceivedPlayerDamage(rawDamage, state.talentEffects, effect.damageType);
}

export function computeIncomingEnemyAttackDamage(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  options: EnemyDamageOptions = {},
) {
  let remainingDamage = applyPhysicalForgeBonus(state, effect);
  if (!options.ignorePlayerMitigation && state.gearEffects.damageReductionPerMana > 0) {
    const absorb = state.gearEffects.damageReductionPerMana * state.mana;
    remainingDamage = Math.max(0, remainingDamage - absorb);
  }
  if (!options.ignorePlayerMitigation && state.enemyStatuses.poison > 0) {
    remainingDamage = Math.max(0, remainingDamage - state.talentEffects.poisonReducesEnemyDamage);
  }
  if (effect.damageType === "burn") {
    remainingDamage += state.enemyStatuses.burnBonus;
  }
  if (effect.damageType === "freeze") {
    remainingDamage += state.enemyStatuses.freezeBonus;
  }
  remainingDamage = Math.max(0, remainingDamage + (options.flatBonus ?? 0));
  remainingDamage = remainingDamage * (options.amountMultiplier ?? 1);
  const paced = paceCombatMagnitude(state, remainingDamage, "enemy");
  return Math.round(paced);
}

function calculateBlockAndArmorMitigation(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  incomingDamage: number,
  combatTexts: CombatTextEvent[],
  options: EnemyDamageOptions,
) {
  let remainingDamage = incomingDamage;
  const effectiveBlock = options.ignorePlayerMitigation ? 0 : computeEffectiveBlock(state, effect);
  const blockAbsorb = Math.min(remainingDamage, effectiveBlock);
  remainingDamage -= blockAbsorb;
  if (blockAbsorb > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockAbsorb });
  }
  const extraPhysicalBlock =
    effect.damageType === "physical" && (options.physicalBlockBreakMultiplier ?? 1) > 1
      ? Math.min(
          Math.max(0, effectiveBlock - blockAbsorb),
          Math.round(blockAbsorb * ((options.physicalBlockBreakMultiplier ?? 1) - 1)),
        )
      : 0;
  const extraPoisonBlock =
    effect.damageType === "poison" && !options.ignorePlayerMitigation
      ? Math.min(Math.max(0, effectiveBlock - blockAbsorb), options.extraPoisonBlockStrip ?? 0)
      : 0;
  const totalExtraBlock = Math.max(extraPhysicalBlock, extraPoisonBlock);
  if (totalExtraBlock > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: totalExtraBlock });
  }
  const armorMitigatesDamage = effect.damageType === "physical" || effect.damageType === "stun";
  const armorAbsorb = armorMitigatesDamage ? Math.min(remainingDamage, state.playerStatuses.armor) : 0;
  const actualDamage = computeMitigatedDamage(state, effect, remainingDamage, options.ignorePlayerMitigation === true);
  return { remainingDamage, blockAbsorb, totalExtraBlock, armorAbsorb, actualDamage };
}

function applyVanguardCrestAfterBlock(
  state: BattleState,
  blockAbsorb: number,
  remainingDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.trinketEffects.vanguardCrestForgeOnBlockAbsorb <= 0 || blockAbsorb <= 0 || remainingDamage !== 0) {
    return state;
  }
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: "forge",
    amount: state.trinketEffects.vanguardCrestForgeOnBlockAbsorb,
  });
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      forge: state.playerStatuses.forge + state.trinketEffects.vanguardCrestForgeOnBlockAbsorb,
    },
  };
}

function applyEnemyForgeDecayOnHit(state: BattleState, actualDamage: number, damageType: string): BattleState {
  if (actualDamage <= 0 || damageType !== "physical" || state.enemyMitigation.forge <= 0) return state;
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      forge: Math.max(0, state.enemyMitigation.forge - BATTLE_CONFIG.FORGE_DECAY_AMOUNT),
    },
  };
}

export function checkHealthThresholds(
  prevHealth: number,
  nextHealth: number,
  state: BattleState,
  combatTexts: CombatTextEvent[],
) {
  let nextState = state;

  function applyHealthThresholdStatBonus(
    currentState: BattleState,
    configs: { threshold: number; amount: number } | Array<{ threshold: number; amount: number }> | null,
    stat: "block" | "armor",
  ): BattleState {
    const bonuses = configs == null ? [] : Array.isArray(configs) ? configs : [configs];
    let next = currentState;
    for (const config of bonuses) {
      const thresholdHp = (state.playerMaxHealth * config.threshold) / PERCENT_DENOMINATOR;
      if (prevHealth > thresholdHp && nextHealth <= thresholdHp) {
        next = applyPlayerStatusEffect(
          next,
          { kind: "player-status", status: stat, amount: config.amount },
          combatTexts,
        );
      }
    }
    return next;
  }

  nextState = applyHealthThresholdStatBonus(nextState, state.talentEffects.healthThresholdBlock, "block");
  nextState = applyHealthThresholdStatBonus(nextState, state.talentEffects.healthThresholdArmor, "armor");
  return nextState;
}

function resolvePostDamageThresholds(
  state: BattleState,
  prevHealth: number,
  blockAbsorb: number,
  remainingDamage: number,
  actualDamage: number,
  damageType: string,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = applyVanguardCrestAfterBlock(state, blockAbsorb, remainingDamage, combatTexts);
  nextState = checkHealthThresholds(prevHealth, nextState.playerHealth, nextState, combatTexts);
  nextState = decayArmorAfterDamage(nextState, actualDamage, "player", combatTexts);
  nextState = applyEnemyForgeDecayOnHit(nextState, actualDamage, damageType);
  return nextState;
}

function healEnemyWithCombatText(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  return applyEnemyHealingWithCombatText(state, amount, combatTexts, { skipFightPacing: true });
}

function applyEnemyDamageTraitReactions(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  traitSet?: ReadonlySet<string>,
): BattleState {
  if (actualDamage <= 0) return state;
  let nextState = state;
  if (effect.damageType === "holy") {
    if (hasEnemyTrait(nextState, "cleric", traitSet)) nextState = healEnemyWithCombatText(nextState, 1, combatTexts);
    if (hasEnemyTrait(nextState, "zealot-enemy", traitSet) || hasEnemyTrait(nextState, "inquisitor", traitSet)) {
      nextState = setFlag(nextState, "enemyNextAttackHolyBonus", nextState.flags.enemyNextAttackHolyBonus + 1);
    }
  }
  if ((effect.damageType === "stun" || effect.damageType === "holy") && hasEnemyTrait(nextState, "paladin", traitSet)) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "block", amount: 1 });
    nextState = addEnemyMitigation(nextState, "block", 1);
  }
  return nextState;
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
  let nextState = applyEnemyHealingWithCombatText(state, healAmount, combatTexts, { skipFightPacing: true });
  if (
    hasEnemyTrait(nextState, "vampire") &&
    state.enemyHealth < state.enemyMaxHealth &&
    nextState.enemyHealth >= state.enemyMaxHealth
  ) {
    nextState = setFlag(nextState, "enemyNextAttackBonus", nextState.flags.enemyNextAttackBonus + 1);
  }
  return nextState;
}

function recordPlayerHealthLost(
  prevHealth: number,
  nextState: BattleState,
  damageType: CombatTextStat,
  combatTexts: CombatTextEvent[],
) {
  const healthLost = prevHealth - nextState.playerHealth;
  if (healthLost > 0) {
    const stat = damageType === "physical" ? "health" : damageType;
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat, amount: healthLost });
  }
}

function applyBlockDepletedHeal(
  prevState: BattleState,
  nextState: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  let finalState = nextState;
  const healAmount = prevState.talentEffects.blockDepletedHeal + prevState.gearEffects.blockDepletedHeal;
  const isBlockDepleted = prevState.playerStatuses.block > 0 && nextState.playerStatuses.block <= 0;

  if (isBlockDepleted && healAmount > 0) {
    finalState = applyHealingWithCombatText(finalState, healAmount, combatTexts);
  }

  if (isBlockDepleted && prevState.gearEffects.stunOnBlockDepleted > 0 && finalState.enemyHealth > 0) {
    finalState = dealPlayerTypedHit(finalState, "stun", prevState.gearEffects.stunOnBlockDepleted, combatTexts);
  }

  if (
    isBlockDepleted &&
    prevState.gearEffects.saintfallRetribution > 0 &&
    !prevState.flags.saintfallRetributionTriggered &&
    finalState.enemyHealth > 0
  ) {
    finalState = {
      ...finalState,
      flags: {
        ...finalState.flags,
        saintfallRetributionTriggered: true,
      },
    };
    finalState = dealPlayerTypedHit(finalState, "holy", prevState.gearEffects.saintfallRetribution, combatTexts);
    finalState = dealPlayerTypedHit(finalState, "stun", prevState.gearEffects.saintfallRetribution, combatTexts);
    finalState = applyHealingWithCombatText(finalState, prevState.gearEffects.saintfallRetribution, combatTexts);
  }

  return finalState;
}

export function processEnemyDamageEffect(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
  options: EnemyDamageOptions = {},
) {
  const incomingDamage = options.incomingDamage ?? computeIncomingEnemyAttackDamage(state, effect, options);

  const { remainingDamage, blockAbsorb, totalExtraBlock, actualDamage } = calculateBlockAndArmorMitigation(
    state,
    effect,
    incomingDamage,
    combatTexts,
    options,
  );

  const prevHealth = state.playerHealth;
  const damagedState = applyPlayerCombatDamage(state, actualDamage, effect.damageType, {
    ignoreMitigation: options.ignorePlayerMitigation === true,
  });
  let nextState: BattleState = {
    ...damagedState,
    playerStatuses: {
      ...damagedState.playerStatuses,
      block: Math.max(
        0,
        damagedState.playerStatuses.block - Math.min(blockAbsorb + totalExtraBlock, damagedState.playerStatuses.block),
      ),
    },
  };

  recordPlayerHealthLost(prevHealth, nextState, effect.damageType, combatTexts);
  nextState = applyBlockDepletedHeal(state, nextState, combatTexts);

  nextState = resolvePostDamageThresholds(
    nextState,
    prevHealth,
    blockAbsorb,
    remainingDamage,
    actualDamage,
    effect.damageType,
    combatTexts,
  );

  const preventStunBuildup = effect.damageType === "stun" && shouldBlockPreventStunBuildup(state);
  if (!preventStunBuildup) {
    nextState = applyPlayerDamageStatuses(nextState, effect, actualDamage);
  }
  nextState = resolvePlayerCrowdControlTriggers(nextState, combatTexts);

  if (effect.lifesteal && actualDamage > 0) {
    nextState = applyEnemyLeechHealing(nextState, actualDamage, combatTexts);
  }

  if (!options.skipTraitReactions) {
    const traitSet = options.traitSet ?? getEnemyTraitSet(nextState);
    nextState = applyEnemyDamageTraitReactions(nextState, effect, actualDamage, combatTexts, traitSet);
    if (
      hasEnemyTrait(nextState, "earth-elemental", traitSet) &&
      state.playerStatuses.block > 0 &&
      nextState.playerStatuses.block <= 0 &&
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

  return nextState;
}
