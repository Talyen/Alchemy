/**
 * Deck draw and shuffle helpers.
 * Depends on: ../utils, ../game-constants, @/lib/game-data.
 * Depended on by: ./battle-setup, ./card-play, ./wish, ./talent-effects.
 *
 * Callers must supply an explicit `rng` (production: `state.rng`; tests: a seeded
 * function). The previous `= Math.random` default was a footgun — AGENTS.md forbids
 * `Math.random()` in the battle engine, and the eslint rule only catches call expressions.
 */
import type { BattleCard } from "@/lib/game-data";
import type { BattleState } from "./types";
import { shuffle, takeRandomItem } from "../utils";
import { MAX_HAND_SIZE } from "../game-constants";

function refillDeck(
  deck: BattleCard[],
  discard: BattleCard[],
  rng: () => number,
): { deck: BattleCard[]; discard: BattleCard[] } | null {
  if (deck.length > 0) return { deck, discard };
  if (discard.length === 0) return null;
  return { deck: shuffle(discard, rng), discard: [] };
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

/** Picks one card from the draw pile without occupying a hand slot, reshuffling discard if needed. */
export function takeRandomCardFromDeck(state: BattleState): {
  card: BattleCard;
  deck: BattleCard[];
  discard: BattleCard[];
  nextCardUid: number;
} | null {
  const refilled = refillDeck([...state.deck], [...state.discard], state.rng);
  if (!refilled || refilled.deck.length === 0) return null;
  const deck = [...refilled.deck];
  const rawCard = takeRandomItem(deck, state.rng);
  if (!rawCard) return null;
  return {
    card: { ...rawCard, uid: state.nextCardUid },
    deck,
    discard: refilled.discard,
    nextCardUid: state.nextCardUid + 1,
  };
}

/** Convenience wrapper that pulls state.deck/discard/hand/rng from BattleState. */
export function drawFromState(state: BattleState, amount: number) {
  return drawCards(state.deck, state.discard, state.hand, amount, state.nextCardUid, state.rng);
}

/** Applies a draw result's deck/discard/hand/uid back onto BattleState. */
export function applyDrawResult(state: BattleState, draw: ReturnType<typeof drawCards>): BattleState {
  return {
    ...state,
    deck: draw.deck,
    discard: draw.discard,
    hand: draw.hand,
    nextCardUid: draw.nextCardUid,
  };
}
