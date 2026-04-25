import type { BattleCard } from "@/lib/game-data";

import { drawCards } from "./draw";
import { applyCardEffects, clampEnemy, clampPlayer, mergeCombatText } from "./effects";
import { cardsPerTurn, type BattleResolution, type BattleState, type CombatTextEvent } from "./types";

export function playBattleCardResolved(state: BattleState, cardId: string): BattleResolution {
  const combatTexts: CombatTextEvent[] = [];

  if (state.mana <= 0 || state.wishOptions) {
    return { state, combatTexts };
  }

  const card = state.hand.find((candidate) => candidate.id === cardId);
  if (!card) {
    return { state, combatTexts };
  }

  let nextState: BattleState = {
    ...state,
    hand: state.hand.filter((candidate) => candidate.id !== cardId),
    mana: Math.max(0, state.mana - card.cost),
  };

  nextState = applyCardEffects(nextState, card, combatTexts);

  if (card.consume) {
    return { state: { ...nextState, exhausted: [...nextState.exhausted, card] }, combatTexts };
  }

  return { state: { ...nextState, discard: [...nextState.discard, card] }, combatTexts };
}

export function playBattleCard(state: BattleState, cardId: string) {
  return playBattleCardResolved(state, cardId).state;
}

function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState: BattleState = {
    ...state,
    enemyStatuses: { ...state.enemyStatuses },
  };

  const burnDamage = nextState.enemyStatuses.burn;
  if (burnDamage > 0) {
    nextState.enemyHealth = clampEnemy(nextState.enemyHealth - burnDamage);
    nextState.enemyStatuses.burn = Math.floor(nextState.enemyStatuses.burn / 2);
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: burnDamage });
  }

  const poisonDamage = nextState.enemyStatuses.poison;
  if (poisonDamage > 0) {
    nextState.enemyHealth = clampEnemy(nextState.enemyHealth - poisonDamage);
    nextState.enemyStatuses.poison = Math.max(0, nextState.enemyStatuses.poison - 1);
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "poison", amount: poisonDamage });
  }

  const bleedDamage = nextState.enemyStatuses.bleed;
  if (bleedDamage > 0) {
    nextState.enemyHealth = clampEnemy(nextState.enemyHealth - bleedDamage);
    if (nextState.enemyStatuses.bleedLeech > 0) {
      nextState.playerHealth = clampPlayer(nextState.playerHealth + bleedDamage);
      nextState.enemyStatuses.bleedLeech = 0;
      mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: bleedDamage });
    }
    nextState.enemyStatuses.bleed = 0;
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "bleed", amount: bleedDamage });
  }

  return nextState;
}

export function advanceBattleTurnResolved(state: BattleState): BattleResolution {
  const combatTexts: CombatTextEvent[] = [];

  if (state.enemyHealth <= 0 || state.playerHealth <= 0 || state.wishOptions) {
    return { state, combatTexts };
  }

  const nextDiscard = [...state.discard, ...state.hand];
  let nextState: BattleState = { ...state, hand: [], discard: nextDiscard };

  nextState.playerStatuses = { ...nextState.playerStatuses, block: Math.floor(nextState.playerStatuses.block / 2) };

  if (nextState.playerStatuses.haste > 0) {
    nextState.playerStatuses.haste -= 1;
  } else {
    nextState = tickEnemyStatuses(nextState, combatTexts);
    if (nextState.enemySkipTurns > 0) {
      nextState.enemySkipTurns -= 1;
    }
  }

  const nextDraw = drawCards(nextState.deck, nextState.discard, [], cardsPerTurn);

  return {
    state: {
      ...nextState,
      deck: nextDraw.deck,
      discard: nextDraw.discard,
      hand: nextDraw.hand,
      mana: nextState.maxMana,
      turn: nextState.turn + 1,
    },
    combatTexts,
  };
}

export function advanceBattleTurn(state: BattleState) {
  return advanceBattleTurnResolved(state).state;
}

export function chooseWishCard(state: BattleState, cardId: string) {
  const chosenCard = state.wishOptions?.find((card) => card.id === cardId);
  if (!chosenCard) {
    return state;
  }

  if (state.hand.length < 7) {
    return { ...state, hand: [...state.hand, chosenCard], wishOptions: null };
  }

  return { ...state, discard: [...state.discard, chosenCard], wishOptions: null };
}
