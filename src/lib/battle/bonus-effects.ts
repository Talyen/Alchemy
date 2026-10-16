import { rollBattleChance } from "./chance-roll";
import {
  resolveLuckyCloverReward,
  resolveNatureGoldReward,
  resolveNatureManaReward,
} from "./resource-reward-resolution";
import { drawFromState, applyDrawResult } from "./draw";
import {
  addGoldWithCombatText,
  gainManaWithCombatText,
  rollForgeAffixAwards,
  addForgeToPlayer,
  applyBlockReward,
} from "./player-rewards";
import type { BattleState, CombatTextEvent } from "./types";
import { resolveCrowdControlBonuses, type CrowdControlTriggerBonuses } from "./crowd-control-resolution";

export type { CrowdControlTriggerBonuses } from "./crowd-control-resolution";

export function applyCrowdControlTriggerBonuses(
  state: BattleState,
  bonuses: CrowdControlTriggerBonuses,
  combatTexts?: CombatTextEvent[],
): BattleState {
  return resolveCrowdControlBonuses(state, bonuses, combatTexts ?? [], {
    draw: (current, amount, texts) => {
      const drawn = applyDrawResult(current, drawFromState(current, amount), texts);
      return drawn.onEmptyDraw?.(drawn, amount, texts) ?? drawn;
    },
    block: applyBlockReward,
    forge: addForgeToPlayer,
    mana: gainManaWithCombatText,
  });
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
