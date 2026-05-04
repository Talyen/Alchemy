import type { BattleCard } from "@/lib/game-data";

import { drawCards } from "./draw";
import { applyCardEffects, clampEnemy, clampPlayer, mergeCombatText } from "./effects";
import { cardsPerTurn, type BattleResolution, type BattleState, type CombatTextEvent, type TurnPhase } from "./types";

export function playBattleCardResolved(state: BattleState, cardId: string, index: number): BattleResolution {
  const combatTexts: CombatTextEvent[] = [];

  if (state.mana <= 0 || state.wishOptions) {
    return { state, combatTexts };
  }

  const card = state.hand[index];
  if (!card || card.id !== cardId) {
    return { state, combatTexts };
  }

  let nextState: BattleState = {
    ...state,
    hand: state.hand.filter((_, i) => i !== index),
    mana: Math.max(0, state.mana - card.cost),
  };

  nextState = applyCardEffects(nextState, card, combatTexts);

  if (card.consume) {
    return { state: { ...nextState, exhausted: [...nextState.exhausted, card] }, combatTexts };
  }

  return { state: { ...nextState, discard: [...nextState.discard, card] }, combatTexts };
}

export function playBattleCard(state: BattleState, cardId: string, index: number) {
  return playBattleCardResolved(state, cardId, index).state;
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

export function endPlayerTurn(state: BattleState): { state: BattleState; combatTexts: CombatTextEvent[] } {
  const combatTexts: CombatTextEvent[] = [];

  let nextState: BattleState = {
    ...state,
    turnPhase: "enemy" as TurnPhase,
    hand: [],
    discard: [...state.discard, ...state.hand],
  };

  if (state.enemySkipTurns > 0) {
    const skipDraw = drawCards(state.deck, nextState.discard, [], cardsPerTurn);
    nextState = {
      ...nextState,
      enemySkipTurns: state.enemySkipTurns - 1,
      turn: state.turn + 1,
      turnPhase: "player" as TurnPhase,
      deck: skipDraw.deck,
      hand: skipDraw.hand,
      discard: [],
      mana: state.maxMana,
      playerStatuses: {
        ...nextState.playerStatuses,
        block: Math.floor((nextState.playerStatuses.block ?? 0) / 2),
      },
    };
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "stun", amount: 0 });
    return { state: nextState, combatTexts };
  }

  nextState = tickEnemyStatuses(nextState, combatTexts);

  if (nextState.enemyHealth <= 0) {
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        block: Math.floor((nextState.playerStatuses.block ?? 0) / 2),
      },
    };
    return { state: nextState, combatTexts };
  }

  const enemyAttack = nextState.enemyAttack;
  let remainingDamage = enemyAttack;

  const blockAbsorb = Math.min(remainingDamage, nextState.playerStatuses.block);
  remainingDamage -= blockAbsorb;
  nextState.playerStatuses = { ...nextState.playerStatuses, block: nextState.playerStatuses.block - blockAbsorb };

  if (blockAbsorb > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockAbsorb });
  }

  const actualDamage = Math.max(0, remainingDamage - nextState.playerStatuses.armor);

  nextState = {
    ...nextState,
    playerHealth: clampPlayer(nextState.playerHealth - actualDamage),
    playerStatuses: {
      ...nextState.playerStatuses,
      block: Math.floor(nextState.playerStatuses.block / 2),
    },
  };

  if (actualDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "health", amount: actualDamage });
  }

  const nextDraw = drawCards(state.deck, nextState.discard, [], cardsPerTurn);
  nextState = {
    ...nextState,
    turn: state.turn + 1,
    turnPhase: "player" as TurnPhase,
    deck: nextDraw.deck,
    hand: nextDraw.hand,
    discard: [],
    mana: state.maxMana,
  };

  return { state: nextState, combatTexts };
}
