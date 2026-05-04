import { enemyBestiary, starterDeck, type BattleCard, type BestiaryEntry } from "@/lib/game-data";

import {
  baseEnemyAttack,
  baseEnemyHealth,
  basePlayerMana,
  cardsPerTurn,
  maxHandSize,
  maxPlayerHealth,
  type BattleState,
  type EnemyStatusValues,
  type PlayerStatusValues,
  type TalentEffectManifest,
  type TurnPhase,
} from "./types";
import { ROOM_SCALING_INCREMENT, STARTING_TURN } from "../game-constants";

// Returns a fresh (deck, discard) pair after possibly reshuffling discard into deck.
function refillDeck(deck: BattleCard[], discard: BattleCard[]) {
  if (deck.length > 0) return { deck, discard };
  if (discard.length === 0) return null;
  return { deck: shuffleCards(discard), discard: [] };
}

// Draws cards from the deck into the hand. If the deck runs out, the discard pile
// is shuffled back into the deck. Stops at maxHandSize.
export function drawCards(deck: BattleCard[], discard: BattleCard[], hand: BattleCard[], amount: number) {
  let nextDeck = [...deck];
  let nextDiscard = [...discard];
  const nextHand = [...hand];

  for (let i = 0; i < amount && nextHand.length < maxHandSize; i++) {
    const refilled = refillDeck(nextDeck, nextDiscard);
    if (!refilled) break;
    nextDeck = refilled.deck;
    nextDiscard = refilled.discard;

    const card = nextDeck.shift();
    if (card) {
      nextHand.push(card);
    }
  }

  return { deck: nextDeck, discard: nextDiscard, hand: nextHand };
}

// Creates the initial BattleState for a fresh encounter. Enemy HP and attack
// scale per room (multiplicative by 1.1x per room after the first) so the game
// gets gradually harder. The scaler uses `roomsEncountered - 1` so room 0
// (the first fight) has no scaling at all.
export function createBattleState(runDeck: BattleCard[] = starterDeck, gold = 0, roomsEncountered = 0, currentEnemy?: BestiaryEntry, playerHealth = maxPlayerHealth, talentEffects: TalentEffectManifest = { flatPhysicalDamage: 0, armorToPhysicalDamage: false, physicalCritChance: 0 }): BattleState {
  const openingHand = drawCards(shuffleCards(runDeck), [], [], cardsPerTurn);

  const enemy = currentEnemy ?? enemyBestiary[0];
  const scaler = Math.max(0, roomsEncountered - 1);
  const hpMultiplier = 1 + scaler * ROOM_SCALING_INCREMENT;
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
    turn: STARTING_TURN,
    turnPhase: "player" as TurnPhase,
    playerHealth,
    enemyHealth: scaledEnemyHealth,
    enemyMaxHealth: scaledEnemyHealth,
    enemyAttack: scaledEnemyAttack,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 } as PlayerStatusValues,
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 0 } as EnemyStatusValues,
    enemySkipTurns: 0,
    wishOptions: null,
    currentEnemy: enemy,
    talentEffects,
  };
}

// Fisher-Yates shuffle — O(n), unbiased, in-place on a clone.
function shuffleCards(cards: BattleCard[]) {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
