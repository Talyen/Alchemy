/**
 * Leaf talent-effect functions for stun/freeze/CC triggers.
 * Depends on: ./draw, ./combat-text, ./types, ../game-constants.
 * Depended on by: ./status-stun-resolve, ./damage-status-riders.
 */
import { drawFromState } from "./draw";
import { mergeCombatText } from "./combat-text";
import { addPlayerStatus, setFlag, stripEnemyArmor, type BattleState, type CombatTextEvent } from "./types";
import { FREE_CARD_SENTINEL } from "../game-constants";

export function applyStunDrawTalent(state: BattleState): BattleState {
  if (state.talentEffects.drawOnStun <= 0) return state;
  const draw = drawFromState(state, state.talentEffects.drawOnStun);
  return {
    ...state,
    deck: draw.deck,
    discard: draw.discard,
    hand: draw.hand,
    nextCardUid: draw.nextCardUid,
  };
}

export function applyStunFreeCardTalent(state: BattleState): BattleState {
  if (!state.talentEffects.nextCardFreeOnStun) return state;
  return setFlag(state, "nextCardCostReduction", FREE_CARD_SENTINEL);
}

function applyBlockOnCCTalent(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  const nextState = addPlayerStatus(state, "block", amount);
  if (combatTexts) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "block",
      amount,
    });
  }
  return nextState;
}

export const applyStunBlockTalent = (state: BattleState, combatTexts?: CombatTextEvent[]) =>
  applyBlockOnCCTalent(state, state.talentEffects.blockOnStun, combatTexts);

function applyStripArmorOnCCTalent(state: BattleState, active: boolean): BattleState {
  if (!active) return state;
  return stripEnemyArmor(state);
}

export const applyStunStripArmorTalent = (state: BattleState) =>
  applyStripArmorOnCCTalent(state, state.talentEffects.stunStripArmor);

export function applyStunManaTalent(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  if (state.talentEffects.manaOnStun <= 0) return state;
  const nextState = { ...state, mana: state.mana + state.talentEffects.manaOnStun };
  if (combatTexts) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "mana",
      amount: state.talentEffects.manaOnStun,
    });
  }
  return nextState;
}

export const applyFreezeBlockTalent = (state: BattleState, combatTexts?: CombatTextEvent[]) =>
  applyBlockOnCCTalent(state, state.talentEffects.blockOnFreeze, combatTexts);

export const applyFreezeStripArmorTalent = (state: BattleState) =>
  applyStripArmorOnCCTalent(state, state.talentEffects.freezeStripArmor);
