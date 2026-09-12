import type { BattleCard } from "@/lib/game-data";
import { cardHasKeyword } from "./card-classification";
import { getBattleRng, rngInt, shuffle, takeRandomItem } from "@/lib/rng";
import type { BattleState } from "./types";
import { MAX_HAND_SIZE } from "../game-constants";

interface CardUidChange {
  previous: number | undefined;
  next: number;
}

/** Draw IDs change for presentation; a turn-long card benefit follows the same instance. */
export function remapDrawnCardBenefits(state: BattleState, changes: readonly CardUidChange[]) {
  const change = changes.find((entry) => entry.previous === state.uniqueGear.redHarvestUid);
  return change ? { ...state.uniqueGear, redHarvestUid: change.next } : state.uniqueGear;
}

function refillDeck(
  deck: BattleCard[],
  discard: BattleCard[],
  rng: () => number,
): { deck: BattleCard[]; discard: BattleCard[] } | null {
  if (deck.length > 0) return { deck, discard };
  if (discard.length === 0) return null;
  return { deck: shuffle(discard, rng), discard: [] };
}

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
  const uidChanges: CardUidChange[] = [];

  for (let i = 0; i < amount && nextHand.length < MAX_HAND_SIZE; i++) {
    const refilled = refillDeck(nextDeck, nextDiscard, rng);
    if (!refilled) break;
    nextDeck = refilled.deck;
    nextDiscard = refilled.discard;

    const card = nextDeck.pop();
    if (!card) break;
    nextHand.push({ ...card, uid });
    if (card.uid !== undefined) uidChanges.push({ previous: card.uid, next: uid });
    uid += 1;
  }

  return { deck: nextDeck, discard: nextDiscard, hand: nextHand, nextCardUid: uid, uidChanges };
}

export function takeRandomCardFromDeck(state: BattleState): {
  card: BattleCard;
  deck: BattleCard[];
  discard: BattleCard[];
  nextCardUid: number;
  uniqueGear: BattleState["uniqueGear"];
} | null {
  const refilled = refillDeck(state.deck, state.discard, getBattleRng(state));
  if (!refilled || refilled.deck.length === 0) return null;
  const deck = [...refilled.deck];
  const rawCard = takeRandomItem(deck, getBattleRng(state));
  if (!rawCard) return null;
  return {
    card: { ...rawCard, uid: state.nextCardUid },
    deck,
    discard: refilled.discard,
    nextCardUid: state.nextCardUid + 1,
    uniqueGear: remapDrawnCardBenefits(state, [{ previous: rawCard.uid, next: state.nextCardUid }]),
  };
}

export function drawFromState(state: BattleState, amount: number) {
  return drawCards(state.deck, state.discard, state.hand, amount, state.nextCardUid, getBattleRng(state));
}

export function applyDrawResult(state: BattleState, draw: ReturnType<typeof drawCards>): BattleState {
  return {
    ...state,
    deck: draw.deck,
    discard: draw.discard,
    hand: draw.hand,
    nextCardUid: draw.nextCardUid,
    uniqueGear: remapDrawnCardBenefits(state, draw.uidChanges),
  };
}

export function drawKeywordCard(state: BattleState, keyword: string): BattleState {
  if (state.hand.length >= MAX_HAND_SIZE) return state;
  const refilled = refillDeck(state.deck, state.discard, getBattleRng(state));
  if (!refilled) return state;
  const indices = refilled.deck.flatMap((card, index) => (cardHasKeyword(card, keyword) ? [index] : []));
  if (indices.length === 0) return state;
  const index = indices[rngInt(getBattleRng(state), indices.length)]!;
  const card = { ...refilled.deck[index]!, uid: state.nextCardUid };
  return {
    ...state,
    deck: refilled.deck.filter((_, i) => i !== index),
    discard: refilled.discard,
    hand: [...state.hand, card],
    nextCardUid: state.nextCardUid + 1,
    uniqueGear: remapDrawnCardBenefits(state, [{ previous: refilled.deck[index]!.uid, next: card.uid }]),
  };
}
