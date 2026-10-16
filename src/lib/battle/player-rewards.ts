import { createPlayerResourceResolver } from "./player-resource-resolution";
import { resolveSecondaryAction } from "./action-context";
import { drawKeywordCard } from "./draw";
import { mergeCombatText } from "./combat-text-events";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import type { DamageType, PlayerStatusId } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { rollBattleChance } from "./chance-roll";
import { damageEnemyHealth } from "./health-state";
import { decayEnemyArmor } from "./enemy-mitigation-state";
import { hasEnemyTrait } from "./encounter-trait-state";
import { paceCombatMagnitude } from "./fight-pacing";

function applyBloodCountessHealingReaction(
  state: BattleState,
  restoredHealth: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (restoredHealth <= 0 || state.enemyHealth <= 0 || !hasEnemyTrait(state, "blood-countess")) return state;
  const enemyWasAlive = state.enemyHealth > 0;
  const holyDamage = 1;
  if (combatTexts) mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "holy", amount: holyDamage });
  const hit = damageEnemyHealth(state, holyDamage);
  const damagedState = processEncounterTraitHealthThreshold(
    hit.previousHealth,
    decayEnemyArmor(hit.state),
    combatTexts ?? [],
  );
  return payKillPayouts(
    recordEnemyAbilityActivation(damagedState, "blood-countess"),
    enemyWasAlive,
    combatTexts ?? [],
    undefined,
    state.playerStatuses.forge >= 5,
  );
}

function applyKillHeal(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  // Defeat healing grants ordinary restore feedback and cleanse, but must not
  // restart the full healing reaction chain while settling a kill.
  const healing = resolveHealingWithFeedback(state, paceCombatMagnitude(state, amount, "player"), combatTexts);
  return applyRestorativeCleanse(healing.state, healing.restored, combatTexts);
}

export function applyGearKillRewards(
  state: BattleState,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
  enemyStatusesOverride?: BattleState["enemyStatuses"],
  forgeAtKill = state.playerStatuses.forge >= 5,
): BattleState {
  if (state.enemyHealth > 0 || !enemyWasAlive) return state;
  let nextState = state;
  const { healOnKill, goldOnKill, healOnBurnEnemyDefeated, goldOnKillWithForge } = state.gearEffects;
  if (healOnKill > 0) {
    nextState = applyKillHeal(nextState, healOnKill, combatTexts);
  }
  const statuses = enemyStatusesOverride ?? state.enemyStatuses;
  if (healOnBurnEnemyDefeated > 0 && statuses.burn > 0) {
    nextState = applyKillHeal(nextState, healOnBurnEnemyDefeated, combatTexts);
  }
  if (goldOnKill > 0) {
    nextState = addGoldWithCombatText(nextState, goldOnKill, combatTexts);
  }
  if (forgeAtKill && goldOnKillWithForge > 0) {
    nextState = addGoldWithCombatText(nextState, goldOnKillWithForge, combatTexts);
  }
  return nextState;
}

export function payKillPayouts(
  state: BattleState,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
  enemyStatusesOverride?: BattleState["enemyStatuses"],
  forgeAtKill = state.playerStatuses.forge >= 5,
): BattleState {
  if (state.enemyHealth > 0 || !enemyWasAlive || state.flags.killRewardsPaid) return state;
  state = { ...state, flags: { ...state.flags, killRewardsPaid: true } };
  const statuses = enemyStatusesOverride ?? state.enemyStatuses;
  if (statuses.poison > 0 && state.talentEffects.goldOnPoisonedKill > 0) {
    state = addGoldWithCombatText(state, state.talentEffects.goldOnPoisonedKill, combatTexts);
  }
  const afterBoneCharm = applyKillHeal(state, state.trinketEffects.boneCharmHealOnKill, combatTexts);
  const rewarded = applyGearKillRewards(afterBoneCharm, enemyWasAlive, combatTexts, statuses, forgeAtKill);
  return rewarded.dodgeChanceFromDamage > 0 ? { ...rewarded, dodgeChanceFromDamage: 0 } : rewarded;
}

// Shared end-of-hit epilogue: encounter-trait health thresholds first, then kill
// payouts. Status-conditional kill rewards evaluate against pre-hit statuses when an
// override is supplied (defensive pattern from applyEnemyDotDamage).
// Forge eligibility also precedes hit rewards, which can grant Forge after the kill.
export function applyHitEpilogue(
  state: BattleState,
  preHitHealth: number,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
  enemyStatusesOverride?: BattleState["enemyStatuses"],
  forgeAtKill = state.playerStatuses.forge >= 5,
): BattleState {
  return payKillPayouts(
    processEncounterTraitHealthThreshold(preHitHealth, state, combatTexts),
    enemyWasAlive,
    combatTexts,
    enemyStatusesOverride,
    forgeAtKill,
  );
}

export function applyIronGuardReward(
  state: BattleState,
  damageType: DamageType,
  healthDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (damageType !== "physical" || healthDamage <= 0) return state;
  return rollBattleChance(state.talentEffects.armorOnPhysicalDamageChance, state)
    ? applyArmorReward(state, healthDamage, combatTexts)
    : state;
}

export function applyArmorReward(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  return resolveSecondaryAction(state, "reward", (current) => applyArmorStatusEffect(current, amount, combatTexts));
}

export function rollForgeAffixAwards(state: BattleState, chances: readonly number[]): number {
  return chances.reduce((total, chance) => total + Number(rollBattleChance(chance, state)), 0);
}

const resources = createPlayerResourceResolver({
  chance: rollBattleChance,
  afterHealing: applyBloodCountessHealingReaction,
  drawHoly: (state, combatTexts) => drawKeywordCard(state, "holy", { combatTexts }),
  forgeReady: (combatTexts) => {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "notice",
      stat: "playNextCardTwice",
      text: "Everkeen Ready",
      signal: "prepared",
    });
  },
});

function resolveHealingWithFeedback(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
  allowOverhealBlock = false,
) {
  return resources.resolveHealingWithFeedback(state, amount, combatTexts, allowOverhealBlock);
}

export function applyHealingWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
  options?: { skipFightPacing?: boolean; allowOverhealBlock?: boolean },
): BattleState {
  return resources.applyHealingWithCombatText(state, amount, combatTexts, options);
}

function applyRestorativeCleanse(state: BattleState, actualHeal: number, combatTexts?: CombatTextEvent[]): BattleState {
  return resources.applyRestorativeCleanse(state, actualHeal, combatTexts);
}

export function applyHealOnManaGain(
  state: BattleState,
  gainAmount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  return resources.applyHealOnManaGain(state, gainAmount, combatTexts);
}

export function gainManaWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
  options?: { skipFightPacing?: boolean; allowOverflow?: boolean },
): BattleState {
  return resources.gainManaWithCombatText(state, amount, combatTexts, options);
}

export function addPlayerStatusWithCombatText(
  state: BattleState,
  stat: PlayerStatusId,
  amount: number,
  combatTexts?: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  return resources.addPlayerStatusWithCombatText(state, stat, amount, combatTexts, options);
}

export function addGoldWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  return resources.addGoldWithCombatText(state, amount, combatTexts);
}

export function applyBlockReward(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  return resources.applyBlockReward(state, amount, combatTexts, options);
}

export function addForgeToPlayer(state: BattleState, baseAmount: number, combatTexts?: CombatTextEvent[]): BattleState {
  return resources.addForgeToPlayer(state, baseAmount, combatTexts);
}

export function applyCleanseHeals(
  state: BattleState,
  combatTexts?: CombatTextEvent[],
  removedStatuses = 1,
): BattleState {
  return resources.applyCleanseHeals(state, combatTexts, removedStatuses);
}

export function removeHarmfulPlayerStatuses(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]) {
  return resources.removeHarmfulPlayerStatuses(state, amount, combatTexts);
}

export function applyArmorStatusEffect(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  return resources.applyArmorStatusEffect(state, amount, combatTexts);
}
