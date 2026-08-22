/**
 * Crowd-control on-trigger bonuses from talents and gear.
 * Depends on: ./draw, ./combat-text, ./types, ./status-forge, ../game-constants.
 * Depended on by: ./status-stun-resolve, ./damage-status-riders.
 */
import { drawFromState, applyDrawResult } from "./draw";
import { mergeCombatText } from "./combat-text";
import { addPlayerStatus, setFlag, stripEnemyArmor, gainMana, type BattleState, type CombatTextEvent } from "./types";
import { addForgeToPlayer } from "./status-forge";
import { FREE_CARD_SENTINEL } from "../game-constants";
import { paceCombatMagnitude } from "./fight-pacing";

export interface CrowdControlTriggerBonuses {
  block?: number;
  forge?: number;
  mana?: number;
  draw?: number;
  nextCardFree?: boolean;
  stripArmor?: boolean;
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
    const before = nextState.playerStatuses.block;
    nextState = addPlayerStatus(nextState, "block", paceCombatMagnitude(nextState, block, "player"));
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "block",
        amount: nextState.playerStatuses.block - before,
      });
    }
  }
  const forge = bonuses.forge ?? 0;
  if (forge > 0) {
    nextState = addForgeToPlayer(nextState, forge, combatTexts);
  }
  if (bonuses.stripArmor) {
    nextState = stripEnemyArmor(nextState);
  }
  const mana = bonuses.mana ?? 0;
  if (mana > 0) {
    const grantedMana = paceCombatMagnitude(nextState, mana, "player");
    const afterMana = gainMana(nextState, grantedMana);
    const gained = afterMana.mana - nextState.mana;
    nextState = afterMana;
    if (gained > 0 && combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "mana",
        amount: gained,
      });
    }
  }
  return nextState;
}
