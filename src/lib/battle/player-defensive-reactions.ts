import type { EnemyAttackEffect } from "@/lib/game-data";
import { addPlayerStatusWithCombatText, applyHealingWithCombatText } from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
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
import { isPlayerDefeated, playerHealthLostToDamage } from "./types/state-helpers";

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

export function applyArmorLossAttackRetaliation(
  state: BattleState,
  armorLost: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  return armorLost > 0 &&
    !isPlayerDefeated(state) &&
    state.enemyHealth > 0 &&
    state.gearEffects.stunOnArmorLostToAttack > 0
    ? resolveFollowUpHit(
        state,
        { source: "player-follow-up", damageType: "stun", amount: state.gearEffects.stunOnArmorLostToAttack },
        combatTexts,
      )
    : state;
}

function resolvePostDamageThresholds(
  state: BattleState,
  prevHealth: number,
  blockAbsorb: number,
  remainingDamage: number,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const healthAfterHit = state.playerHealth;
  let armorLost = 0;
  // Decay the Armor present for the hit before threshold rewards grant new Armor.
  let nextState = decayArmorAfterDamage(state, actualDamage, "player", combatTexts, (amount) => {
    armorLost = amount;
  });
  nextState = applyVanguardCrestAfterBlock(nextState, blockAbsorb, remainingDamage, combatTexts);
  nextState = checkHealthThresholds(prevHealth, healthAfterHit, nextState, combatTexts);
  nextState = applyArmorLossAttackRetaliation(nextState, armorLost, combatTexts);
  return nextState;
}

function recordPlayerHealthLost(
  prevState: BattleState,
  nextState: BattleState,
  damageType: CombatTextStat,
  combatTexts: CombatTextEvent[],
) {
  const healthLost = playerHealthLostToDamage(prevState, nextState);
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
  if (isPlayerDefeated(nextState)) return nextState;
  let finalState = nextState;
  const healAmount = prevState.talentEffects.blockDepletedHeal + prevState.gearEffects.blockDepletedHeal;

  if (isBlockDepleted && healAmount > 0) {
    finalState = applyHealingWithCombatText(finalState, healAmount, combatTexts);
  }

  // The hit depleted Block even if threshold or healing rewards refilled it.
  if (isBlockDepleted && prevState.talentEffects.forgeOnBlockDepleted > 0) {
    finalState = addForgeToPlayer(finalState, prevState.talentEffects.forgeOnBlockDepleted, combatTexts);
  }

  if (isBlockDepleted && prevState.gearEffects.thornsOnBlockDepleted > 0) {
    finalState = addPlayerStatusWithCombatText(
      finalState,
      "thorns",
      prevState.gearEffects.thornsOnBlockDepleted,
      combatTexts,
    );
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
  return state;
}

export function applyPlayerDefensiveReactions(
  nextState: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  facts: {
    before: BattleState;
    mitigation: { blockAbsorb: number; remainingDamage: number; actualDamage: number };
    blockLost: number;
    blockDepletedByStrip?: boolean;
  },
  combatTexts: CombatTextEvent[],
  protectionState = facts.before,
): BattleState {
  const {
    before: state,
    mitigation: { blockAbsorb, remainingDamage, actualDamage },
    blockLost,
    blockDepletedByStrip,
  } = facts;
  const prevHealth = state.playerHealth;
  if (blockAbsorb > 0 && state.gearEffects.blockReadiesFreePhysical > 0) {
    nextState = { ...nextState, uniqueGear: { ...nextState.uniqueGear, knightsAnswerReady: true } };
  }
  recordPlayerHealthLost(state, nextState, effect.damageType, combatTexts);

  if (
    nextState.enemyHealth > 0 &&
    nextState.playerHealth > 0 &&
    !shouldBlockPreventStatusBuildup(protectionState, effect.damageType)
  ) {
    nextState = applyPlayerDamageStatuses(nextState, effect, actualDamage);
  }

  nextState = resolvePostDamageThresholds(
    nextState,
    prevHealth,
    blockAbsorb,
    remainingDamage,
    actualDamage,
    combatTexts,
  );
  nextState = applyBlockDepletedHeal(
    state,
    nextState,
    combatTexts,
    blockDepletedByStrip === true || (blockLost > 0 && blockLost === state.playerStatuses.block),
  );

  return nextState;
}
