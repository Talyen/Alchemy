import { readCombatFlag, resolveSecondaryAction } from "./action-context";
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import { rollBattleChance } from "./chance-roll";
import { drawKeywordCard } from "./draw";
import { applyPercentBonus, crossesGainThreshold } from "./amount-helpers";
import { FIRST_EFFECT_MULTIPLIER, HALF_DIVISOR } from "../game-constants";
import { mergeCombatText } from "./combat-text-events";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import type { DamageType, PlayerStatusId } from "@/lib/game-data";
import {
  blockAmountWithForge,
  damageEnemyHealth,
  decayEnemyArmor,
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
    emitGainedStatusText(state, healing.state, "block", combatTexts);
    emitGainedStatusText(state, healing.state, "thorns", combatTexts);
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
  const damagedState = processEncounterTraitHealthThreshold(
    hit.previousHealth,
    decayEnemyArmor(hit.state),
    combatTexts ?? [],
  );
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
  const healing = resolveHealingWithFeedback(state, healAmount, combatTexts, options?.allowOverhealBlock);
  const nextState = healing.state;
  const actualHeal = healing.restored;
  const reacted = applyBlockGainRewards(
    applyBloodCountessHealingReaction(nextState, actualHeal, combatTexts),
    nextState.playerStatuses.block - state.playerStatuses.block,
    combatTexts ?? [],
  );
  return applyRestorativeCleanse(reacted, actualHeal, combatTexts);
}

function applyRestorativeCleanse(state: BattleState, actualHeal: number, combatTexts?: CombatTextEvent[]): BattleState {
  return actualHeal > 0 &&
    state.gearEffects.healCleanseChance > 0 &&
    harmfulPlayerStatusIds.some((status) => state.playerStatuses[status] > 0) &&
    rollBattleChance(state.gearEffects.healCleanseChance, state)
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
    emitGainedStatusText(previousState, nextState, "thorns", combatTexts);
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
  if (rollBattleChance(nextState.talentEffects.armorOnBlockChance, nextState)) {
    nextState = applyArmorReward(nextState, gained, combatTexts);
  }
  if (rollBattleChance(nextState.talentEffects.drawHolyOnBlockChance, nextState)) {
    nextState = drawKeywordCard(nextState, "holy", { combatTexts });
  }
  return nextState;
}

export function applyCleanseHeals(
  state: BattleState,
  combatTexts?: CombatTextEvent[],
  removedStatuses = 1,
): BattleState {
  let nextState = state;
  for (let index = 0; index < removedStatuses; index++) {
    nextState = applyHealingWithCombatText(
      nextState,
      nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
      combatTexts,
    );
    nextState = applyHealingWithCombatText(nextState, nextState.talentEffects.healOnStatusCleanse, combatTexts);
    if (nextState.gearEffects.blockOnCleanse > 0) {
      nextState = applyBlockReward(nextState, nextState.gearEffects.blockOnCleanse, combatTexts ?? []);
    }
    if (nextState.gearEffects.manaOnCleanse > 0) {
      nextState = gainManaWithCombatText(nextState, nextState.gearEffects.manaOnCleanse, combatTexts ?? []);
    }
    if (nextState.talentEffects.nextHolyFreeOnCleanse) nextState = setFlag(nextState, "nextHolyCardFree", true);
  }
  return nextState;
}

export function removeHarmfulPlayerStatuses(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]) {
  const limit = Number.isFinite(amount) ? amount : harmfulPlayerStatusIds.length;
  let nextState = state;
  let removed = 0;
  for (const statusId of harmfulPlayerStatusIds) {
    if (removed >= limit) break;
    if (nextState.playerStatuses[statusId] <= 0) continue;
    nextState = setPlayerStatus(nextState, statusId, 0);
    if (combatTexts) {
      mergeCombatText(combatTexts, { target: "player", kind: "notice", stat: statusId, signal: "cleanse", text: "" });
    }
    removed++;
  }
  // Clear all selected statuses before healing can trigger further cleansing.
  return applyCleanseHeals(nextState, combatTexts, removed);
}

function applyArmorTalentChecks(state: BattleState, amount: number, combatTexts: CombatTextEvent[]) {
  if (state.playerHealth < state.playerMaxHealth / HALF_DIVISOR) {
    amount = applyPercentBonus(amount, state.talentEffects.armorLowHealthBonusPercent);
  }
  if (state.talentEffects.firstArmorCardDoubled && !readCombatFlag(state, "firstArmorCardDoubledUsed")) {
    amount *= FIRST_EFFECT_MULTIPLIER;
    state = setFlag(state, "firstArmorCardDoubledUsed", true);
  }
  const armorAmount = rollBattleChance(state.talentEffects.armorDoubleChance, state) ? amount * 2 : amount;
  const newArmor = state.playerStatuses.armor + armorAmount;
  if (crossesGainThreshold(state.playerStatuses.armor, newArmor, state.talentEffects.armorBlockThreshold)) {
    state = applyBlockReward(state, state.talentEffects.armorBlockAmount, combatTexts);
  }
  if (crossesGainThreshold(state.playerStatuses.armor, newArmor, state.talentEffects.armorCleanseThreshold)) {
    state = removeHarmfulPlayerStatuses(state, Number.POSITIVE_INFINITY, combatTexts);
  }
  return { state, amount: armorAmount };
}

export function applyArmorStatusEffect(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (amount <= 0) return state;
  const armorBefore = state.playerStatuses.armor;
  const checked = applyArmorTalentChecks(
    state,
    amount + state.talentEffects.flatArmorAmount + state.gearEffects.flatArmorGained,
    combatTexts,
  );
  state = checked.state;
  amount = checked.amount;
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "armor", amount });
  const nextState = addPlayerStatus(state, "armor", amount);
  const armorGained = nextState.playerStatuses.armor - armorBefore;
  if (armorGained <= 0) return nextState;
  const rewardedState = rollBattleChance(nextState.talentEffects.armorCleanseChance, nextState)
    ? removeHarmfulPlayerStatuses(nextState, 1, combatTexts)
    : nextState;
  return rollBattleChance(nextState.talentEffects.goldOnArmorGainChance, rewardedState)
    ? addGoldWithCombatText(rewardedState, armorGained, combatTexts)
    : rewardedState;
}
