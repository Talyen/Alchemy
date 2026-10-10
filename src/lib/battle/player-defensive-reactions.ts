import type { EnemyAttackEffect } from "@/lib/game-data";
import { applyHealingWithCombatText } from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import { resolvePlayerHit } from "./hit-resolution";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { decayArmorAfterDamage } from "./status-helpers";
import {
  addForgeToPlayer,
  applyBlockDepletionRewards,
  applyPlayerDamageStatuses,
  checkHealthThresholds,
  shouldBlockPreventStatusBuildup,
} from "./status-player";
import type { BattleState, CombatTextEvent, CombatTextStat } from "./types";
import { isPlayerDefeated, playerHealthLostToDamage } from "./health-state";

function applyVanguardCrestAfterBlock(
  state: BattleState,
  blockAbsorb: number,
  remainingDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (
    state.flags.vanguardCrestUsedThisTurn ||
    state.trinketEffects.vanguardCrestForgeOnBlockAbsorb <= 0 ||
    blockAbsorb <= 0 ||
    remainingDamage !== 0
  ) {
    return state;
  }
  return addForgeToPlayer(
    { ...state, flags: { ...state.flags, vanguardCrestUsedThisTurn: true } },
    state.trinketEffects.vanguardCrestForgeOnBlockAbsorb,
    combatTexts,
  );
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
  // The hit depleted Block even if threshold or healing rewards refilled it.
  let finalState = applyBlockDepletionRewards(prevState, nextState, combatTexts, isBlockDepleted);
  if (isBlockDepleted)
    finalState = addForgeToPlayer(finalState, prevState.talentEffects.forgeOnBlockDepleted, combatTexts);

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
    preDamageBlockStrip?: number;
    attackBlockLost?: number;
    isBlockDepleted?: boolean;
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
    isBlockDepleted: factsBlockDepleted,
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
    if (
      actualDamage > 0 &&
      nextState.playerCC.cooldown > 0 &&
      (effect.damageType === "stun" || effect.damageType === "freeze")
    ) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "notice",
        stat: effect.damageType,
        signal: "immune",
        text: `Immune to ${effect.damageType === "stun" ? "Stun" : "Freeze"}`,
      });
    }
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
  const isBlockDepleted =
    factsBlockDepleted ??
    (blockDepletedByStrip === true || (blockLost > 0 && blockLost === state.playerStatuses.block));
  nextState = applyBlockDepletedHeal(protectionState, nextState, combatTexts, isBlockDepleted);

  return nextState;
}
