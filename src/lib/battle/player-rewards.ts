import { resolveSecondaryAction } from "./action-context";
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import { drawKeywordCard } from "./draw";
import { applyPercentBonus } from "./amount-helpers";
import { HALF_DIVISOR } from "../game-constants";
import { mergeCombatText } from "./combat-text-events";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import type { DamageType, PlayerStatusId } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { rollBattleChance } from "./chance-roll";
import { blockAmountWithForge, setPlayerStatus, addPlayerStatus } from "./status-state";
import { damageEnemyHealth, resolvePlayerHealing } from "./health-state";
import { decayEnemyArmor } from "./enemy-mitigation-state";
import { writeCombatFlag as setFlag } from "./action-context";
import { gainMana, scaleGoldReward } from "./resource-state";
import { hasEnemyTrait } from "./encounter-trait-state";
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
  return payKillPayouts(
    recordEnemyAbilityActivation(damagedState, "blood-countess"),
    enemyWasAlive,
    combatTexts ?? [],
    undefined,
    state.playerStatuses.forge >= 5,
  );
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
  return state.gearEffects.goldGrantsForgeAndHoly > 0 && rollBattleChance(25, nextState)
    ? addForgeToPlayer(nextState, 1, combatTexts)
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

export function applyBlockReward(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  return addPlayerStatusWithCombatText(state, "block", amount, combatTexts, options);
}

export function rollForgeAffixAwards(state: BattleState, chances: readonly number[]): number {
  return chances.reduce((total, chance) => total + Number(rollBattleChance(chance, state)), 0);
}

export function addForgeToPlayer(state: BattleState, baseAmount: number, combatTexts?: CombatTextEvent[]): BattleState {
  if (baseAmount <= 0) return state;
  let amount = baseAmount;
  if (state.playerStatuses.burn > 0 && rollBattleChance(state.talentEffects.forgeBurningBonusChance, state))
    amount += 1;
  if (rollBattleChance(state.talentEffects.forgeBonusChance, state)) amount += 1;
  if (
    state.playerHealth < state.playerMaxHealth / HALF_DIVISOR &&
    rollBattleChance(state.talentEffects.forgeLowHealthBonusChance, state)
  )
    amount += 1;
  if (amount <= 0) return state;
  let nextState = addPlayerStatus(state, "forge", amount);
  if (state.gearEffects.blockOnForgeGain > 0)
    nextState = applyBlockReward(nextState, state.gearEffects.blockOnForgeGain, combatTexts ?? []);
  if (combatTexts) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "forge",
      amount,
    });
  }
  return nextState;
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

export function applyArmorStatusEffect(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (amount <= 0) return state;
  const armorBefore = state.playerStatuses.armor;
  if (state.gearEffects.flatArmorGained > 0 && !state.flags.layeredArmorUsedThisTurn) {
    amount += state.gearEffects.flatArmorGained;
    state = setFlag(state, "layeredArmorUsedThisTurn", true);
  }
  if (state.playerHealth < state.playerMaxHealth / HALF_DIVISOR)
    amount = applyPercentBonus(amount, state.talentEffects.armorLowHealthBonusPercent);
  if (rollBattleChance(state.talentEffects.armorDoubleChance, state)) amount *= 2;
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
