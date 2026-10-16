import { rollBattleChance } from "./chance-roll";
import {
  resolveLuckyCloverReward,
  resolveNatureGoldReward,
  resolveNatureManaReward,
} from "./resource-reward-resolution";
import { FREE_CARD_SENTINEL } from "../game-constants";
import { drawFromState, applyDrawResult } from "./draw";
import { addGoldWithCombatText, gainManaWithCombatText } from "./player-rewards";
import type { BattleState, CombatTextEvent } from "./types";
import { writeCombatFlag as setFlag } from "./action-context";
import { stripEnemyArmor, stripEnemyBlock } from "./enemy-mitigation-state";
import { rollForgeAffixAwards, addForgeToPlayer, applyBlockReward } from "./status-player";
import { mergeCombatText } from "./combat-text-events";

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
  combatTexts?: CombatTextEvent[],
): BattleState {
  let nextState = state;
  const draw = bonuses.draw ?? 0;
  if (draw > 0) {
    nextState = applyDrawResult(nextState, drawFromState(nextState, draw), combatTexts);
    nextState = nextState.onEmptyDraw?.(nextState, draw, combatTexts ?? []) ?? nextState;
  }
  if (bonuses.nextCardFree) {
    nextState = setFlag(nextState, "nextCardCostReduction", FREE_CARD_SENTINEL);
  }
  const block = bonuses.block ?? 0;
  if (block > 0) {
    nextState = applyBlockReward(nextState, block, combatTexts ?? []);
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
    if (combatTexts && nextState.enemyMitigation[stat] > 0) {
      mergeCombatText(combatTexts, {
        target: "enemy",
        kind: "damage",
        stat,
        amount: nextState.enemyMitigation[stat],
        impact: false,
      });
    }
    nextState = strip(nextState);
  }
  const mana = bonuses.mana ?? 0;
  if (mana > 0) {
    nextState = gainManaWithCombatText(nextState, mana, combatTexts);
  }
  return nextState;
}

const resourceRewardPort = { chance: rollBattleChance, mana: gainManaWithCombatText, gold: addGoldWithCombatText };

export function applyLuckyCloverGold(state: BattleState, healthDamage: number, combatTexts: CombatTextEvent[]) {
  return resolveLuckyCloverReward(state, healthDamage, combatTexts, resourceRewardPort);
}

export function applyNatureManaRefund(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  return resolveNatureManaReward(state, damage, combatTexts, resourceRewardPort);
}

export function applyNatureGoldReward(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  return resolveNatureGoldReward(state, damage, combatTexts, resourceRewardPort);
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
