import { readCombatFlag, resolveSecondaryAction } from "./action-context";
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { drawKeywordCard } from "./draw";
import { applyPercentBonus } from "./amount-helpers";
import { FIRST_EFFECT_MULTIPLIER, HALF_DIVISOR } from "../game-constants";
import { mergeCombatText } from "./combat-text-events";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import type { PlayerStatusId } from "@/lib/game-data";
import {
  blockAmountWithForge,
  damageEnemyHealth,
  setFlag,
  setPlayerStatus,
  addPlayerStatus,
  gainMana,
  resolvePlayerHealing,
  scaleGoldReward,
  hasEnemyTrait,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { paceCombatMagnitude } from "./fight-pacing";

function emitGainedStatusText(
  before: Pick<BattleState, "playerStatuses">,
  after: Pick<BattleState, "playerStatuses">,
  stat: "block" | "thorns",
  combatTexts: CombatTextEvent[],
) {
  const gained = after.playerStatuses[stat] - before.playerStatuses[stat];
  if (gained <= 0) return;
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat, amount: gained });
}

export function emitOverhealBlockText(
  stateBefore: Pick<BattleState, "playerStatuses">,
  stateAfter: Pick<BattleState, "playerStatuses">,
  combatTexts: CombatTextEvent[],
) {
  emitGainedStatusText(stateBefore, stateAfter, "block", combatTexts);
}

function emitReactiveThornsText(
  stateBefore: Pick<BattleState, "playerStatuses">,
  stateAfter: Pick<BattleState, "playerStatuses">,
  combatTexts: CombatTextEvent[],
) {
  emitGainedStatusText(stateBefore, stateAfter, "thorns", combatTexts);
}

function resolveHealingWithFeedback(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
  allowOverhealBlock = false,
) {
  const healing = resolvePlayerHealing(state, amount, allowOverhealBlock);
  if (combatTexts) {
    if (healing.effective > 0) {
      mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healing.effective });
    }
    emitOverhealBlockText(state, healing.state, combatTexts);
    emitReactiveThornsText(state, healing.state, combatTexts);
  }
  return healing;
}

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
  const damagedState = processEncounterTraitHealthThreshold(hit.previousHealth, hit.state, combatTexts ?? []);
  return payKillPayouts(recordEnemyAbilityActivation(damagedState, "blood-countess"), enemyWasAlive, combatTexts ?? []);
}

export function applyHealingWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
  options?: { skipFightPacing?: boolean; allowOverhealBlock?: boolean },
): BattleState {
  if (amount <= 0) return state;
  const healAmount = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "player");
  const prevState = state;
  const healing = resolveHealingWithFeedback(state, healAmount, combatTexts, options?.allowOverhealBlock);
  const nextState = healing.state;
  const actualHeal = healing.restored;
  const reacted = applyBlockGainRewards(
    applyBloodCountessHealingReaction(nextState, actualHeal, combatTexts),
    nextState.playerStatuses.block - prevState.playerStatuses.block,
    combatTexts ?? [],
  );
  return applyRestorativeCleanse(reacted, actualHeal, combatTexts);
}

function applyRestorativeCleanse(state: BattleState, actualHeal: number, combatTexts?: CombatTextEvent[]): BattleState {
  return actualHeal > 0 &&
    state.gearEffects.healCleanseChance > 0 &&
    harmfulPlayerStatusIds.some((status) => state.playerStatuses[status] > 0) &&
    rollRewardChance(state.gearEffects.healCleanseChance, state)
    ? removeHarmfulPlayerStatuses(state, 1, combatTexts)
    : state;
}

export function applyHealOnManaGain(
  state: BattleState,
  gainAmount: number,
  combatTexts: CombatTextEvent[],
  manaBeforeGain: number,
): BattleState {
  if (gainAmount <= 0) return state;
  if (state.talentEffects.healthPerMana > 0) {
    return applyHealingWithCombatText(state, gainAmount * state.talentEffects.healthPerMana, combatTexts);
  }
  if (state.talentEffects.healOnManaGain <= 0 || manaBeforeGain !== 0) return state;
  return applyHealingWithCombatText(state, state.talentEffects.healOnManaGain, combatTexts);
}

export function gainManaWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
  options?: { skipFightPacing?: boolean; allowOverflow?: boolean },
): BattleState {
  if (amount <= 0) return state;
  const granted = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "player");
  const nextState = gainMana(state, granted, options?.allowOverflow);
  const gained = nextState.mana - state.mana;
  if (gained > 0 && combatTexts) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: gained });
  }
  return applyHealOnManaGain(nextState, gained, combatTexts ?? [], state.mana);
}

export function addPlayerStatusWithCombatText(
  state: BattleState,
  stat: PlayerStatusId,
  amount: number,
  combatTexts?: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  if (amount <= 0) return state;
  if (stat === "block") amount = blockAmountWithForge(state, amount);
  const before = state.playerStatuses[stat];
  const previousState = state;
  const nextState = addPlayerStatus(
    state,
    stat,
    options?.skipFightPacing || stat === "armor" ? amount : paceCombatMagnitude(state, amount, "player"),
  );
  const delta = nextState.playerStatuses[stat] - before;
  if (delta > 0 && combatTexts) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat, amount: delta });
  }
  if (stat === "block" && combatTexts) {
    emitReactiveThornsText(previousState, nextState, combatTexts);
  }
  return stat === "block" ? applyBlockGainRewards(nextState, delta, combatTexts ?? []) : nextState;
}

export function addGoldWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (amount <= 0) return state;

  const scaledGold = scaleGoldReward(amount, state.gearEffects);
  let nextState = { ...state, gold: state.gold + scaledGold };
  if (state.playerStatuses.block === 0 && state.talentEffects.blockPerGold > 0) {
    nextState = addPlayerStatusWithCombatText(
      nextState,
      "block",
      Math.round(scaledGold * state.talentEffects.blockPerGold),
      combatTexts,
      { skipFightPacing: true },
    );
  }
  if (combatTexts) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "gold",
      amount: scaledGold,
    });
  }
  if (nextState.gearEffects.healOnCombatGoldGain > 0) {
    nextState = applyHealingWithCombatText(nextState, nextState.gearEffects.healOnCombatGoldGain, combatTexts ?? []);
  }
  if (state.gearEffects.goldGrantsForgeAndHoly <= 0 || state.playerStatuses.forge > 0) return nextState;
  const previousForge = nextState.playerStatuses.forge;
  nextState = addPlayerStatusWithCombatText(nextState, "forge", scaledGold, combatTexts, { skipFightPacing: true });
  const nextForge = nextState.playerStatuses.forge;
  const thresholds = [
    state.talentEffects.forgeBurnThreshold,
    state.talentEffects.forgeStripArmorThreshold,
    state.talentEffects.forgeBlockThreshold,
  ];
  return thresholds.some((threshold) => threshold > 0 && previousForge < threshold && nextForge >= threshold)
    ? { ...nextState, pendingForgeThresholds: [...nextState.pendingForgeThresholds, { previousForge, nextForge }] }
    : nextState;
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
  forgeAtKill = state.playerStatuses.forge > 0,
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
): BattleState {
  if (state.enemyHealth > 0 || !enemyWasAlive || state.flags.killRewardsPaid) return state;
  const forgeAtKill = state.playerStatuses.forge > 0;
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
export function applyHitEpilogue(
  state: BattleState,
  preHitHealth: number,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
  enemyStatusesOverride?: BattleState["enemyStatuses"],
): BattleState {
  return payKillPayouts(
    processEncounterTraitHealthThreshold(preHitHealth, state, combatTexts),
    enemyWasAlive,
    combatTexts,
    enemyStatusesOverride,
  );
}

function rollRewardChance(chance: number, state: BattleState): boolean {
  return chance > 0 && rollPercent(chance, getBattleRng(state));
}

export function applyArmorReward(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  return resolveSecondaryAction(state, "reward", (current) => applyArmorStatusEffect(current, amount, combatTexts));
}

export function applyBlockReward(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  return addPlayerStatusWithCombatText(state, "block", amount, combatTexts, options);
}

function applyBlockGainRewards(state: BattleState, gained: number, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (gained <= 0) return nextState;
  if (rollRewardChance(nextState.talentEffects.armorOnBlockChance, nextState)) {
    nextState = applyArmorReward(nextState, gained, combatTexts);
  }
  if (rollRewardChance(nextState.talentEffects.drawHolyOnBlockChance, nextState)) {
    nextState = drawKeywordCard(nextState, "holy");
  }
  return nextState;
}

export function applyCleanseHeals(
  state: BattleState,
  combatTexts?: CombatTextEvent[],
  removedStatuses = 1,
): BattleState {
  const nextState = applyHealingWithCombatText(
    state,
    state.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
    combatTexts,
  );
  const healed = applyHealingWithCombatText(nextState, nextState.talentEffects.healOnStatusCleanse, combatTexts);
  const blocked =
    healed.gearEffects.blockOnCleanse > 0
      ? applyBlockReward(healed, healed.gearEffects.blockOnCleanse * removedStatuses, combatTexts ?? [])
      : healed;
  const restored =
    blocked.gearEffects.manaOnCleanse > 0
      ? gainManaWithCombatText(blocked, blocked.gearEffects.manaOnCleanse * removedStatuses, combatTexts ?? [])
      : blocked;
  return restored.talentEffects.nextHolyFreeOnCleanse ? setFlag(restored, "nextHolyCardFree", true) : restored;
}

export function removeHarmfulPlayerStatuses(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]) {
  const limit = Number.isFinite(amount) ? amount : harmfulPlayerStatusIds.length;
  let nextState = state;
  let removed = 0;
  for (const statusId of harmfulPlayerStatusIds) {
    if (removed >= limit) break;
    if (nextState.playerStatuses[statusId] <= 0) continue;
    nextState = setPlayerStatus(nextState, statusId, 0);
    removed++;
  }
  if (removed) {
    for (const stat of harmfulPlayerStatusIds) {
      if (state.playerStatuses[stat] > 0 && nextState.playerStatuses[stat] === 0 && combatTexts) {
        mergeCombatText(combatTexts, { target: "player", kind: "notice", stat, signal: "cleanse", text: "" });
      }
    }
    for (let index = 0; index < removed; index++) {
      nextState = applyCleanseHeals(nextState, combatTexts);
    }
  }
  return nextState;
}

export function onFirstCrossThreshold(
  prevValue: number,
  nextValue: number,
  threshold: number,
  onCross: (s: BattleState) => BattleState,
  state: BattleState,
): BattleState {
  if (threshold <= 0 || prevValue >= threshold || nextValue < threshold) return state;
  return onCross(state);
}

function applyArmorTalentChecks(state: BattleState, amount: number, combatTexts: CombatTextEvent[]) {
  if (state.playerHealth < state.playerMaxHealth / HALF_DIVISOR) {
    amount = state.talentEffects.armorDoubledBelowHalfHealth
      ? amount * FIRST_EFFECT_MULTIPLIER
      : applyPercentBonus(amount, state.talentEffects.armorLowHealthBonusPercent);
  }
  if (state.talentEffects.firstArmorCardDoubled && !readCombatFlag(state, "firstArmorCardDoubledUsed")) {
    amount *= FIRST_EFFECT_MULTIPLIER;
    state = setFlag(state, "firstArmorCardDoubledUsed", true);
  }
  const armorAmount = rollRewardChance(state.talentEffects.armorDoubleChance, state) ? amount * 2 : amount;
  const newArmor = state.playerStatuses.armor + armorAmount;
  const thresholds: Array<{ threshold: number; apply: (s: BattleState) => BattleState }> = [
    {
      threshold: state.talentEffects.armorBlockThreshold,
      apply: (s) => applyBlockReward(s, s.talentEffects.armorBlockAmount, combatTexts),
    },
    {
      threshold: state.talentEffects.armorCleanseThreshold,
      apply: (s) => removeHarmfulPlayerStatuses(s, Number.POSITIVE_INFINITY, combatTexts),
    },
  ];
  for (const { threshold, apply } of thresholds) {
    state = onFirstCrossThreshold(state.playerStatuses.armor, newArmor, threshold, apply, state);
  }
  return { state, amount: armorAmount };
}

export function applyArmorStatusEffect(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const armorBefore = state.playerStatuses.armor;
  const checked = applyArmorTalentChecks(
    state,
    amount + state.talentEffects.flatArmorAmount + (amount > 0 ? state.gearEffects.flatArmorGained : 0),
    combatTexts,
  );
  state = checked.state;
  amount = checked.amount;
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "armor", amount });
  const nextState = addPlayerStatus(state, "armor", amount);
  const armorGained = nextState.playerStatuses.armor - armorBefore;
  if (armorGained <= 0) return nextState;
  if (rollRewardChance(nextState.talentEffects.armorCleanseChance, nextState)) {
    const cleansed = removeHarmfulPlayerStatuses(nextState, 1, combatTexts);
    return rollRewardChance(state.talentEffects.goldOnArmorGainChance, cleansed)
      ? addGoldWithCombatText(cleansed, armorGained, combatTexts)
      : cleansed;
  }
  return rollRewardChance(nextState.talentEffects.goldOnArmorGainChance, nextState)
    ? addGoldWithCombatText(nextState, armorGained, combatTexts)
    : nextState;
}
