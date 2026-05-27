/**
 * Leaf talent-effect functions extracted from status-effects.ts for stun/freeze/CC triggers.
 * Depends on: ./draw, ./combat-text, ./types, ../game-constants.
 * Depended on by: ./status-effects.
 */
import { drawCards } from "./draw";
import { mergeCombatText } from "./combat-text";
import { addPlayerStatus, setFlag, type BattleState, type CombatTextEvent } from "./types";
import { FREE_CARD_SENTINEL } from "../game-constants";

export function applyStunDrawTalent(state: BattleState): BattleState {
  if (state.talentEffects.drawOnStun <= 0) return state;
  const draw = drawCards(state.deck, state.discard, state.hand, state.talentEffects.drawOnStun, state.nextCardUid);
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
  if (!active || state.enemyMitigation.armor <= 0) return state;
  return { ...state, enemyMitigation: { ...state.enemyMitigation, armor: 0 } };
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
