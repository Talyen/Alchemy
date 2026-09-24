import { readCombatFlag, resolveSecondaryAction } from "./action-context";
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { drawKeywordCard } from "./draw";
import { applyPercentBonus } from "./amount-helpers";
import { FIRST_EFFECT_MULTIPLIER, HALF_DIVISOR } from "../game-constants";
import { mergeCombatText } from "./combat-text-events";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";
export { mergeCombatText, shouldShowCombatText } from "./combat-text-events";
export { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import type { PlayerStatusId } from "@/lib/game-data";
import {
  blockAmountWithForge,
  damageEnemyHealth,
  setFlag,
  setPlayerStatus,
  addPlayerStatus,
  resolvePlayerHealing,
  gainMana,
  scaleGoldReward,
  hasEnemyTrait,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { paceCombatMagnitude } from "./fight-pacing";

export function emitOverhealBlockText(
  stateBefore: Pick<BattleState, "playerStatuses">,
  stateAfter: Pick<BattleState, "playerStatuses">,
  combatTexts: CombatTextEvent[],
) {
  if (stateAfter.playerStatuses.block <= stateBefore.playerStatuses.block) return;
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: "block",
    amount: stateAfter.playerStatuses.block - stateBefore.playerStatuses.block,
  });
}

function emitReactiveThornsText(
  stateBefore: Pick<BattleState, "playerStatuses">,
  stateAfter: Pick<BattleState, "playerStatuses">,
  combatTexts: CombatTextEvent[],
) {
  const thornsGained = stateAfter.playerStatuses.thorns - stateBefore.playerStatuses.thorns;
  if (thornsGained <= 0) return;
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: "thorns",
    amount: thornsGained,
  });
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
  const healing = resolvePlayerHealing(state, healAmount, options?.allowOverhealBlock);
  const nextState = healing.state;
  const actualHeal = healing.restored;
  if (combatTexts) {
    if (healing.effective > 0) {
      mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healing.effective });
    }
    emitOverhealBlockText(prevState, nextState, combatTexts);
    emitReactiveThornsText(prevState, nextState, combatTexts);
  }
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
  if (state.playerStatuses.block === 0 && state.talentEffects.blockPerGold > 0 && scaledGold > 0) {
    nextState = addPlayerStatusWithCombatText(
      nextState,
      "block",
      Math.round(scaledGold * state.talentEffects.blockPerGold),
      combatTexts,
      { skipFightPacing: true },
    );
  }
  if (combatTexts && scaledGold > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "gold",
      amount: scaledGold,
    });
  }
  if (scaledGold > 0 && nextState.gearEffects.healOnCombatGoldGain > 0) {
    nextState = applyHealingWithCombatText(nextState, nextState.gearEffects.healOnCombatGoldGain, combatTexts ?? []);
  }
  if (state.gearEffects.goldGrantsForgeAndHoly <= 0 || scaledGold <= 0 || state.playerStatuses.forge > 0)
    return nextState;
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

function applyKillRewardHealing(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  const previousState = state;
  const healing = resolvePlayerHealing(state, paceCombatMagnitude(state, amount, "player"));
  const nextState = healing.state;
  if (healing.effective > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healing.effective });
  }
  emitOverhealBlockText(previousState, nextState, combatTexts);
  emitReactiveThornsText(previousState, nextState, combatTexts);
  return applyRestorativeCleanse(nextState, healing.restored, combatTexts);
}

function applyKillRewardGold(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  return addGoldWithCombatText(state, amount, combatTexts);
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
    nextState = applyKillRewardHealing(nextState, healOnKill, combatTexts);
  }
  const statuses = enemyStatusesOverride ?? state.enemyStatuses;
  if (healOnBurnEnemyDefeated > 0 && statuses.burn > 0) {
    nextState = applyKillRewardHealing(nextState, healOnBurnEnemyDefeated, combatTexts);
  }
  if (goldOnKill > 0) {
    nextState = applyKillRewardGold(nextState, goldOnKill, combatTexts);
  }
  if (forgeAtKill && goldOnKillWithForge > 0) {
    nextState = applyKillRewardGold(nextState, goldOnKillWithForge, combatTexts);
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
  const afterBoneCharm = applyKillRewardHealing(state, state.trinketEffects.boneCharmHealOnKill, combatTexts);
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

function clearHarmfulStatuses(state: BattleState, statusTypesToClear: number) {
  let nextState = state;
  let removed = 0;
  const limit = Number.isFinite(statusTypesToClear) ? statusTypesToClear : harmfulPlayerStatusIds.length;
  for (const statusId of harmfulPlayerStatusIds) {
    if (removed >= limit) break;
    if (nextState.playerStatuses[statusId] <= 0) continue;
    nextState = setPlayerStatus(nextState, statusId, 0);
    removed++;
  }
  return { nextState, removed };
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
  const cleared = clearHarmfulStatuses(state, amount);
  let nextState = cleared.nextState;
  if (cleared.removed) {
    for (const stat of harmfulPlayerStatusIds) {
      if (state.playerStatuses[stat] > 0 && nextState.playerStatuses[stat] === 0 && combatTexts) {
        mergeCombatText(combatTexts, { target: "player", kind: "notice", stat, signal: "cleanse", text: "" });
      }
    }
    for (let index = 0; index < cleared.removed; index++) {
      nextState = applyCleanseHeals(nextState, combatTexts);
    }
  }
  return nextState;
}

function scaleArmorAmount(state: BattleState, amount: number): { state: BattleState; amount: number } {
  let nextAmount = amount;
  let nextState = state;
  if (nextState.playerHealth < nextState.playerMaxHealth / HALF_DIVISOR) {
    nextAmount = nextState.talentEffects.armorDoubledBelowHalfHealth
      ? nextAmount * FIRST_EFFECT_MULTIPLIER
      : applyPercentBonus(nextAmount, nextState.talentEffects.armorLowHealthBonusPercent);
  }
  if (nextState.talentEffects.firstArmorCardDoubled && !readCombatFlag(nextState, "firstArmorCardDoubledUsed")) {
    nextAmount *= FIRST_EFFECT_MULTIPLIER;
    nextState = setFlag(nextState, "firstArmorCardDoubledUsed", true);
  }
  return { state: nextState, amount: nextAmount };
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

function procArmorBlockThreshold(state: BattleState, newArmor: number, combatTexts: CombatTextEvent[]) {
  return onFirstCrossThreshold(
    state.playerStatuses.armor,
    newArmor,
    state.talentEffects.armorBlockThreshold,
    (s) => applyBlockReward(s, s.talentEffects.armorBlockAmount, combatTexts),
    state,
  );
}

function procArmorCleanseThreshold(state: BattleState, newArmor: number, combatTexts: CombatTextEvent[]) {
  return onFirstCrossThreshold(
    state.playerStatuses.armor,
    newArmor,
    state.talentEffects.armorCleanseThreshold,
    (s) => removeHarmfulPlayerStatuses(s, Number.POSITIVE_INFINITY, combatTexts),
    state,
  );
}

function applyArmorTalentChecks(state: BattleState, amount: number, combatTexts: CombatTextEvent[]) {
  const scaled = scaleArmorAmount(state, amount);
  const armorAmount = rollRewardChance(scaled.state.talentEffects.armorDoubleChance, scaled.state)
    ? scaled.amount * 2
    : scaled.amount;
  const newArmor = scaled.state.playerStatuses.armor + armorAmount;
  const withBlock = procArmorBlockThreshold(scaled.state, newArmor, combatTexts);
  const withCleanse = procArmorCleanseThreshold(withBlock, newArmor, combatTexts);
  return { state: withCleanse, amount: armorAmount };
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
  if (
    nextState.playerStatuses.armor > armorBefore &&
    rollRewardChance(nextState.talentEffects.armorCleanseChance, nextState)
  ) {
    const cleansed = removeHarmfulPlayerStatuses(nextState, 1, combatTexts);
    return state.talentEffects.goldOnArmorGainChance > 0 &&
      rollRewardChance(state.talentEffects.goldOnArmorGainChance, cleansed)
      ? addGoldWithCombatText(cleansed, nextState.playerStatuses.armor - armorBefore, combatTexts)
      : cleansed;
  }
  if (
    nextState.playerStatuses.armor > armorBefore &&
    rollRewardChance(nextState.talentEffects.goldOnArmorGainChance, nextState)
  ) {
    return addGoldWithCombatText(nextState, nextState.playerStatuses.armor - armorBefore, combatTexts);
  }
  return nextState;
}
