import { FREE_CARD_SENTINEL } from "../game-constants";
import { writeCombatFlag } from "./action-context";
import { isPlayerDefeated } from "./battle-outcome";
import { stripEnemyArmor, stripEnemyBlock } from "./enemy-mitigation-state";
import { emitDamageText } from "./combat-text-events";
import { rollBattleChance } from "./chance-roll";
import { drawFromState, applyDrawResult } from "./draw";
import {
  addGoldWithCombatText,
  gainManaWithCombatText,
  rollForgeAffixAwards,
  addForgeToPlayer,
  applyBlockReward,
} from "./player-rewards";
import type { BattleState, CombatTextEvent } from "./types";

export interface CrowdControlTriggerBonuses {
  block?: number;
  forge?: number;
  mana?: number;
  draw?: number;
  nextCardFree?: boolean;
  stripArmor?: boolean;
  stripBlock?: boolean;
}

export function applyCrowdControlTriggerBonuses(
  state: BattleState,
  bonuses: CrowdControlTriggerBonuses,
  combatTexts: CombatTextEvent[] = [],
): BattleState {
  let nextState = state;
  const draw = bonuses.draw ?? 0;
  if (draw > 0) {
    const drawn = applyDrawResult(nextState, drawFromState(nextState, draw), combatTexts);
    nextState = drawn.onEmptyDraw?.(drawn, draw, combatTexts) ?? drawn;
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (bonuses.nextCardFree) {
    nextState = writeCombatFlag(nextState, "nextCardCostReduction", FREE_CARD_SENTINEL);
  }
  const block = bonuses.block ?? 0;
  if (block > 0) {
    nextState = applyBlockReward(nextState, block, combatTexts);
  }
  const forge = bonuses.forge ?? 0;
  if (forge > 0) {
    nextState = addForgeToPlayer(nextState, forge, combatTexts);
  }
  for (const [stat, enabled, strip] of [
    ["armor", bonuses.stripArmor, stripEnemyArmor],
    ["block", bonuses.stripBlock, stripEnemyBlock],
  ] as const) {
    if (!enabled) continue;
    if (nextState.enemyMitigation[stat] > 0) {
      emitDamageText(combatTexts, "enemy", stat, nextState.enemyMitigation[stat], { impact: false });
    }
    nextState = strip(nextState);
  }
  const mana = bonuses.mana ?? 0;
  if (mana > 0) {
    nextState = gainManaWithCombatText(nextState, mana, combatTexts);
  }
  return nextState;
}

export function applyLuckyCloverGold(state: BattleState, healthDamage: number, combatTexts: CombatTextEvent[]) {
  if (state.trinketEffects.luckyCloverGoldChance <= 0 || healthDamage <= 0) return state;
  return rollBattleChance(state.trinketEffects.luckyCloverGoldChance, state)
    ? addGoldWithCombatText(state, healthDamage, combatTexts)
    : state;
}

export function applyNatureManaRefund(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0 || state.gearEffects.manaOnNatureDamageChance <= 0) return state;
  return rollBattleChance(state.gearEffects.manaOnNatureDamageChance, state)
    ? gainManaWithCombatText(state, 1, combatTexts)
    : state;
}

export function applyNatureGoldReward(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  return damage > 0 && rollBattleChance(state.talentEffects.goldOnNatureDamageChance, state)
    ? addGoldWithCombatText(state, damage, combatTexts)
    : state;
}

export function applyEmberforgedPayout(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  enemyWasBurningBefore: boolean,
): BattleState {
  return !enemyWasBurningBefore
    ? addForgeToPlayer(state, rollForgeAffixAwards(state, state.gearEffects.forgeOnBurnVsUnburnedChances), combatTexts)
    : state;
}

export function resolveBleedGoldReward(
  state: BattleState,
  healthDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  return healthDamage > 0 && rollBattleChance(state.trinketEffects.cutpurseGoldChance, state)
    ? addGoldWithCombatText(state, healthDamage, combatTexts)
    : state;
}
