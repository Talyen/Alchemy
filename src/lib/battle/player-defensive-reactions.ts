import type { EnemyAttackEffect } from "@/lib/game-data";
import { BATTLE_CONFIG } from "../game-constants";
import { applyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { resolvePlayerHit } from "./hit-resolution";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { decayArmorAfterDamage } from "./status-helpers";
import {
  addForgeToPlayer,
  applyPlayerDamageStatuses,
  checkHealthThresholds,
  shouldBlockPreventStatusBuildup,
} from "./status-player";
import type { BattleState, CombatTextEvent, CombatTextStat } from "./types";
import { hasEnemyTrait } from "./types/state-helpers";

function applyVanguardCrestAfterBlock(
  state: BattleState,
  blockAbsorb: number,
  remainingDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.trinketEffects.vanguardCrestForgeOnBlockAbsorb <= 0 || blockAbsorb <= 0 || remainingDamage !== 0) {
    return state;
  }
  return addForgeToPlayer(state, state.trinketEffects.vanguardCrestForgeOnBlockAbsorb, combatTexts);
}

function applyEnemyForgeDecayOnHit(state: BattleState, actualDamage: number, damageType: string): BattleState {
  if (hasEnemyTrait(state, "whitehot")) return state;
  if (actualDamage <= 0 || (damageType !== "physical" && damageType !== "stun") || state.enemyMitigation.forge <= 0)
    return state;
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      forge: Math.max(0, state.enemyMitigation.forge - BATTLE_CONFIG.FORGE_DECAY_AMOUNT),
    },
  };
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
  isBlockDepleted: boolean,
): BattleState {
  let finalState = nextState;
  const healAmount = prevState.talentEffects.blockDepletedHeal + prevState.gearEffects.blockDepletedHeal;

  if (isBlockDepleted && healAmount > 0) {
    finalState = applyHealingWithCombatText(finalState, healAmount, combatTexts);
  }

  // The hit depleted Block even if threshold or healing rewards refilled it.
  if (isBlockDepleted && prevState.talentEffects.forgeOnBlockDepleted > 0) {
    finalState = addForgeToPlayer(finalState, prevState.talentEffects.forgeOnBlockDepleted, combatTexts);
  }

  if (isBlockDepleted && prevState.gearEffects.stunOnBlockDepleted > 0 && finalState.enemyHealth > 0) {
    finalState = resolveFollowUpHit(
      finalState,
      { source: "player-follow-up", damageType: "stun", amount: prevState.gearEffects.stunOnBlockDepleted },
      combatTexts,
    );
  }

  if (isBlockDepleted && prevState.gearEffects.saintfallRetribution > 0 && finalState.enemyHealth > 0) {
    finalState = resolveFollowUpHit(
      finalState,
      { source: "player-follow-up", damageType: "holy", amount: prevState.gearEffects.saintfallRetribution },
      combatTexts,
    );
    finalState = applyHealingWithCombatText(finalState, prevState.gearEffects.saintfallRetribution, combatTexts);
  }

  return finalState;
}

export function applyBlockedAttackRetaliation(
  state: BattleState,
  blockLost: number,
  combatTexts: CombatTextEvent[],
  blockDepleted: boolean,
): BattleState {
  if (state.enemyHealth <= 0 || state.playerHealth <= 0) return state;
  if (state.talentEffects.holyReflectionBlockLostPercent > 0) {
    return blockDepleted ? resolvePlayerHit(state, { source: "reflected-holy", blockLost }, combatTexts) : state;
  }
  const amount = state.talentEffects.holyOnAttackBlocked;
  if (amount <= 0 || state.enemyHealth <= 0 || state.playerHealth <= 0) return state;
  return resolvePlayerHit(state, { source: "blocked-attack", amount }, combatTexts);
}

export function applyPlayerDefensiveReactions(
  nextState: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  facts: {
    before: BattleState;
    mitigation: { blockAbsorb: number; remainingDamage: number; actualDamage: number };
    blockLost: number;
  },
  combatTexts: CombatTextEvent[],
): BattleState {
  const {
    before: state,
    mitigation: { blockAbsorb, remainingDamage, actualDamage },
    blockLost,
  } = facts;
  const prevHealth = state.playerHealth;
  if (blockAbsorb > 0 && state.gearEffects.blockReadiesFreePhysical > 0) {
    nextState = { ...nextState, uniqueGear: { ...nextState.uniqueGear, knightsAnswerReady: true } };
  }
  recordPlayerHealthLost(prevHealth, nextState, effect.damageType, combatTexts);

  if (
    nextState.enemyHealth > 0 &&
    nextState.playerHealth > 0 &&
    !shouldBlockPreventStatusBuildup(state, effect.damageType)
  ) {
    nextState = applyPlayerDamageStatuses(nextState, effect, actualDamage);
  }

  nextState = resolvePostDamageThresholds(
    nextState,
    prevHealth,
    blockAbsorb,
    remainingDamage,
    actualDamage,
    effect.damageType,
    combatTexts,
  );
  nextState = applyBlockDepletedHeal(
    state,
    nextState,
    combatTexts,
    blockLost > 0 && blockLost === state.playerStatuses.block,
  );

  return nextState;
}
