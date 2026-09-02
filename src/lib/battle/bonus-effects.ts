import { getBattleRng, rollPercent } from "../rng";
import { FREE_CARD_SENTINEL } from "../game-constants";
import { drawFromState, applyDrawResult } from "./draw";
import {
  addGoldWithCombatText,
  gainManaWithCombatText,
  addPlayerStatusWithCombatText,
  mergeCombatText,
} from "./combat-text";
import { setFlag, stripEnemyArmor, stripEnemyBlock, type BattleState, type CombatTextEvent } from "./types";
import { addForgeToPlayer } from "./status-player";

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

export function applyIronwoodBuckler(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (
    state.trinketEffects.blockToArmorThreshold > 0 &&
    state.playerStatuses.block >= state.trinketEffects.blockToArmorThreshold
  ) {
    state = {
      ...state,
      playerStatuses: {
        ...state.playerStatuses,
        armor: state.playerStatuses.armor + state.trinketEffects.blockToArmorAmount,
      },
    };
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "armor",
      amount: state.trinketEffects.blockToArmorAmount,
    });
  }
  return state;
}

export function applyLuckyCloverGold(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (state.trinketEffects.luckyCloverGoldChance <= 0 || damage <= 0) return state;
  if (rollPercent(state.trinketEffects.luckyCloverGoldChance, getBattleRng(state))) {
    return addGoldWithCombatText(state, damage, combatTexts);
  }
  return state;
}
