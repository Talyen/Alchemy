import { rollBattleChance } from "./chance-roll";
import { FREE_CARD_SENTINEL } from "../game-constants";
import { drawFromState, applyDrawResult } from "./draw";
import { addGoldWithCombatText, gainManaWithCombatText } from "./player-rewards";
import { setFlag, stripEnemyArmor, stripEnemyBlock, type BattleState, type CombatTextEvent } from "./types";
import { addForgeToPlayer, applyBlockReward } from "./status-player";
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

export function applyLuckyCloverGold(state: BattleState, healthDamage: number, combatTexts: CombatTextEvent[]) {
  if (state.trinketEffects.luckyCloverGoldChance <= 0 || healthDamage <= 0) return state;
  if (rollBattleChance(state.trinketEffects.luckyCloverGoldChance, state)) {
    return addGoldWithCombatText(state, healthDamage, combatTexts);
  }
  return state;
}

export function applyNatureManaRefund(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0 || state.gearEffects.manaOnNatureDamageChance <= 0) return state;
  return rollBattleChance(state.gearEffects.manaOnNatureDamageChance, state)
    ? gainManaWithCombatText(state, 1, combatTexts)
    : state;
}

export function applyNatureGoldReward(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0 || !rollBattleChance(state.talentEffects.goldOnNatureDamageChance, state)) return state;
  return addGoldWithCombatText(state, damage, combatTexts);
}

// Shared burn-hit forge payout (card hits and talent follow-ups grant the
// same forge; kept here so the two call sites cannot drift apart).
export function applyBurnForgePayout(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  enemyWasBurningBefore: boolean,
): BattleState {
  let nextState = state;
  if (state.talentEffects.forgeOnBurnDealt > 0) {
    nextState = addForgeToPlayer(nextState, state.talentEffects.forgeOnBurnDealt, combatTexts);
  }
  return applyEmberforgedPayout(nextState, combatTexts, enemyWasBurningBefore);
}

export function applyEmberforgedPayout(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  enemyWasBurningBefore: boolean,
): BattleState {
  return state.gearEffects.forgeOnBurnVsUnburned > 0 && !enemyWasBurningBefore
    ? addForgeToPlayer(state, state.gearEffects.forgeOnBurnVsUnburned, combatTexts)
    : state;
}
