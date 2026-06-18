/**
 * Deck draw and shuffle helpers.
 * Depends on: ../utils, ../game-constants, @/lib/game-data.
 * Depended on by: ./battle-setup, ./card-play, ./wish, ./talent-effects.
 *
 * Callers must supply an explicit `rng` (production: `state.rng`; tests: any seeded
 * function). The previous `= Math.random` default was a footgun — AGENTS.md forbids
 * `Math.random()` in the battle engine, and the eslint rule only catches call expressions.
 */
import type { BattleCard } from "@/lib/game-data";
import { shuffle } from "../utils";
import { MAX_HAND_SIZE } from "../game-constants";

function refillDeck(
  deck: BattleCard[],
  discard: BattleCard[],
  rng: () => number,
): { deck: BattleCard[]; discard: BattleCard[] } | null {
  if (deck.length > 0) return { deck, discard };
  if (discard.length === 0) return null;
  return { deck: shuffleCards(discard, rng), discard: [] };
}

/** Draws cards from the deck into the hand, reshuffling discard when the deck empties. */
export function drawCards(
  deck: BattleCard[],
  discard: BattleCard[],
  hand: BattleCard[],
  amount: number,
  nextCardUid: number,
  rng: () => number,
) {
  let nextDeck = [...deck];
  let nextDiscard = [...discard];
  const nextHand = [...hand];
  let uid = nextCardUid;

  for (let i = 0; i < amount && nextHand.length < MAX_HAND_SIZE; i++) {
    const refilled = refillDeck(nextDeck, nextDiscard, rng);
    if (!refilled) break;
    nextDeck = refilled.deck;
    nextDiscard = refilled.discard;

    const card = nextDeck.shift();
    if (!card) break;
    nextHand.push({ ...card, uid });
    uid += 1;
  }

  return { deck: nextDeck, discard: nextDiscard, hand: nextHand, nextCardUid: uid };
}

export function shuffleCards(cards: BattleCard[], rng: () => number) {
  return shuffle(cards, rng);
}
