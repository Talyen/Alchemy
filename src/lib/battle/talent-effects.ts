/**
 * Crowd-control on-trigger bonuses from talents and gear.
 */
import { drawFromState, applyDrawResult } from "./draw";
import { addPlayerStatusWithCombatText, gainManaWithCombatText } from "./combat-text";
import { setFlag, stripEnemyArmor, stripEnemyBlock, type BattleState, type CombatTextEvent } from "./types";
import { addForgeToPlayer } from "./status-forge";
import { FREE_CARD_SENTINEL } from "../game-constants";

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
    nextState = applyDrawResult(nextState, drawFromState(nextState, draw));
  }
  if (bonuses.nextCardFree) {
    nextState = setFlag(nextState, "nextCardCostReduction", FREE_CARD_SENTINEL);
  }
  const block = bonuses.block ?? 0;
  if (block > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "block", block, combatTexts);
  }
  const forge = bonuses.forge ?? 0;
  if (forge > 0) {
    nextState = addForgeToPlayer(nextState, forge, combatTexts);
  }
  if (bonuses.stripArmor) {
    nextState = stripEnemyArmor(nextState);
  }
  if (bonuses.stripBlock) {
    nextState = stripEnemyBlock(nextState);
  }
  const mana = bonuses.mana ?? 0;
  if (mana > 0) {
    nextState = gainManaWithCombatText(nextState, mana, combatTexts);
  }
  return nextState;
}
