import { enemyBestiary, starterDeck, type BattleCard, type BestiaryEntry } from "@/lib/game-data";

import {
  baseEnemyAttack,
  baseEnemyHealth,
  basePlayerMana,
  cardsPerTurn,
  emptyEnemyStatuses,
  emptyPlayerStatuses,
  maxHandSize,
  maxPlayerHealth,
  type BattleState,
  type TurnPhase,
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

export function createBattleState(runDeck: BattleCard[] = starterDeck, gold = 0, roomsEncountered = 0, currentEnemy?: BestiaryEntry, playerHealth = maxPlayerHealth): BattleState {
  const openingHand = drawCards(shuffleCards(runDeck), [], [], cardsPerTurn);

  const enemy = currentEnemy ?? enemyBestiary[0];
  const scaler = Math.max(0, roomsEncountered - 1);
  const hpMultiplier = 1 + scaler * 0.1;
  const scaledEnemyHealth = Math.floor(baseEnemyHealth * hpMultiplier);
  const scaledEnemyAttack = Math.floor(baseEnemyAttack * hpMultiplier);

  return {
    deck: openingHand.deck,
    hand: openingHand.hand,
    discard: openingHand.discard,
    exhausted: [],
    mana: basePlayerMana,
    maxMana: basePlayerMana,
    gold,
    turn: 1,
    turnPhase: "player" as TurnPhase,
    playerHealth,
    enemyHealth: scaledEnemyHealth,
    enemyMaxHealth: scaledEnemyHealth,
    enemyAttack: scaledEnemyAttack,
    playerStatuses: emptyPlayerStatuses(),
    enemyStatuses: emptyEnemyStatuses(),
    enemySkipTurns: 0,
    wishOptions: null,
    currentEnemy: enemy,
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
