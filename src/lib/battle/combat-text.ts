import { recordEnemyAbilityActivation } from "./battle-metrics";
import type { PlayerStatusId } from "@/lib/game-data";
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import {
  addPlayerStatus,
  applyPlayerHealing,
  clampHealth,
  gainMana,
  scaleGoldReward,
  hasEnemyTrait,
  type BattleState,
  type CombatTextEvent,
  type NumericCombatTextEvent,
} from "./types";
import { paceCombatMagnitude } from "./fight-pacing";

function isNoticeCombatText(event: CombatTextEvent) {
  return event.kind === "notice";
}

function isNumericCombatText(event: CombatTextEvent): event is NumericCombatTextEvent {
  return event.kind !== "notice";
}

export function shouldShowCombatText(event: CombatTextEvent) {
  return event.kind !== "status" || !harmfulPlayerStatusIds.includes(event.stat as never);
}

export function mergeCombatText(combatTexts: CombatTextEvent[], nextEvent: CombatTextEvent) {
  if (!shouldShowCombatText(nextEvent)) return;

  if (isNoticeCombatText(nextEvent)) {
    const existingNotice = combatTexts.find(
      (event) =>
        isNoticeCombatText(event) &&
        event.target === nextEvent.target &&
        event.stat === nextEvent.stat &&
        event.text === nextEvent.text,
    );
    if (!existingNotice) combatTexts.push(nextEvent);
    return;
  }

  const existingEvent = combatTexts.find(
    (event): event is NumericCombatTextEvent =>
      isNumericCombatText(event) &&
      event.target === nextEvent.target &&
      event.kind === nextEvent.kind &&
      event.stat === nextEvent.stat,
  );
  if (existingEvent) {
    existingEvent.amount += nextEvent.amount;
    return;
  }
  combatTexts.push(nextEvent);
}

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
  const damagedState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -holyDamage, state.enemyMaxHealth),
  };
  return payKillPayouts(recordEnemyAbilityActivation(damagedState, "blood-countess"), enemyWasAlive, combatTexts ?? []);
}

export function applyHealingWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  if (amount <= 0) return state;
  const healAmount = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "player");
  const prevState = state;
  const nextState = applyPlayerHealing(state, healAmount);
  const actualHeal = nextState.playerHealth - prevState.playerHealth;
  if (combatTexts) {
    if (actualHeal > 0) {
      mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: actualHeal });
    }
    emitOverhealBlockText(prevState, nextState, combatTexts);
    emitReactiveThornsText(prevState, nextState, combatTexts);
  }
  return applyBloodCountessHealingReaction(nextState, actualHeal, combatTexts);
}

export function applyEnemyHealingWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  if (amount <= 0 || state.enemyHealth <= 0) return state;
  const healAmount = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "enemy");
  const nextHealth = clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth);
  const actualHeal = nextHealth - state.enemyHealth;
  if (actualHeal <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: actualHeal });
  return applyBloodCountessHealingReaction({ ...state, enemyHealth: nextHealth }, actualHeal, combatTexts);
}

export function applyHealOnManaGain(
  state: BattleState,
  gainAmount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.talentEffects.healOnManaGain <= 0 || gainAmount <= 0) return state;
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
  return applyHealOnManaGain(nextState, gained, combatTexts ?? []);
}

export function addPlayerStatusWithCombatText(
  state: BattleState,
  stat: PlayerStatusId,
  amount: number,
  combatTexts?: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  if (amount <= 0) return state;
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
  return nextState;
}

export function addGoldWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (amount <= 0) return state;

  const scaledGold = scaleGoldReward(amount, state.gearEffects);
  let nextState = { ...state, gold: state.gold + scaledGold };
  if (state.talentEffects.blockPerGold > 0 && scaledGold > 0) {
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
  return state.gearEffects.goldGrantsForgeAndHoly > 0
    ? addPlayerStatusWithCombatText(nextState, "forge", scaledGold, combatTexts, { skipFightPacing: true })
    : nextState;
}

function applyKillRewardHealing(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  const previousState = state;
  const nextState = applyPlayerHealing(state, paceCombatMagnitude(state, amount, "player"));
  const actualHeal = nextState.playerHealth - previousState.playerHealth;
  if (actualHeal > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: actualHeal });
  }
  emitOverhealBlockText(previousState, nextState, combatTexts);
  emitReactiveThornsText(previousState, nextState, combatTexts);
  return nextState;
}

function applyKillRewardGold(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  return addGoldWithCombatText(state, amount, combatTexts);
}

export function applyGearKillRewards(
  state: BattleState,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.enemyHealth > 0 || !enemyWasAlive) return state;
  let nextState = state;
  const { healOnKill, goldOnKill, healOnBurnEnemyDefeated } = state.gearEffects;
  if (healOnKill > 0) {
    nextState = applyKillRewardHealing(nextState, healOnKill, combatTexts);
  }
  if (healOnBurnEnemyDefeated > 0 && state.enemyStatuses.burn > 0) {
    nextState = applyKillRewardHealing(nextState, healOnBurnEnemyDefeated, combatTexts);
  }
  if (goldOnKill > 0) {
    nextState = applyKillRewardGold(nextState, goldOnKill, combatTexts);
  }
  return nextState;
}

export function payKillPayouts(
  state: BattleState,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  const afterBoneCharm =
    state.enemyHealth <= 0 && enemyWasAlive
      ? applyKillRewardHealing(state, state.trinketEffects.boneCharmHealOnKill, combatTexts)
      : state;
  const rewarded = applyGearKillRewards(afterBoneCharm, enemyWasAlive, combatTexts);
  return rewarded.enemyHealth <= 0 && rewarded.dodgeChanceFromDamage > 0
    ? { ...rewarded, dodgeChanceFromDamage: 0 }
    : rewarded;
}
