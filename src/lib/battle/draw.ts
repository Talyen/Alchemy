import { starterDeck, type BattleCard } from "@/lib/game-data";

import {
  cardsPerTurn,
  emptyEnemyStatuses,
  emptyPlayerStatuses,
  maxEnemyHealth,
  maxHandSize,
  maxPlayerHealth,
  type BattleState,
} from "./types";

export function drawCards(deck: BattleCard[], discard: BattleCard[], hand: BattleCard[], amount: number) {
  let nextDeck = [...deck];
  let nextDiscard = [...discard];
  const nextHand = [...hand];
  let remaining = amount;

  while (remaining > 0 && nextHand.length < maxHandSize) {
    if (nextDeck.length === 0) {
      if (nextDiscard.length === 0) {
        break;
      }

      nextDeck = shuffleCards(nextDiscard);
      nextDiscard = [];
    }

    const nextCard = nextDeck.shift();
    if (!nextCard) {
      break;
    }

    nextHand.push(nextCard);
    remaining -= 1;
  }

  return {
    deck: nextDeck,
    discard: nextDiscard,
    hand: nextHand,
  };
}

export function createBattleState(runDeck: BattleCard[] = starterDeck, gold = 0): BattleState {
  const openingHand = drawCards(shuffleCards(runDeck), [], [], cardsPerTurn);

  return {
    deck: openingHand.deck,
    hand: openingHand.hand,
    discard: openingHand.discard,
    exhausted: [],
    mana: 4,
    maxMana: 4,
    gold,
    turn: 1,
    playerHealth: maxPlayerHealth,
    enemyHealth: maxEnemyHealth,
    playerStatuses: emptyPlayerStatuses(),
    enemyStatuses: emptyEnemyStatuses(),
    enemySkipTurns: 0,
    wishOptions: null,
  };
}

function shuffleCards(cards: BattleCard[]) {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
