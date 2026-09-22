import type { BattleCard } from "@/lib/game-data";
import { cardHasKeyword } from "./card-classification";
import { getBattleRng, rngInt, shuffle, takeRandomItem } from "@/lib/rng";
import type { BattleState } from "./types";
import { MAX_HAND_SIZE } from "../game-constants";

interface CardUidChange {
  previous: number | undefined;
  next: number;
}

/** Draw IDs change for presentation; turn-long card benefits follow the same instance. */
function remapDrawnCardBenefits(state: BattleState, changes: readonly CardUidChange[]) {
  // Echoed archery cards need no remap: echoes replay by reference, not by uid.
  const remapUid = (uid: number | null) => {
    if (uid === null) return null;
    const change = changes.find((entry) => entry.previous === uid);
    return change ? change.next : uid;
  };
  const uniqueGear = state.uniqueGear;
  const redHarvestUid = remapUid(uniqueGear.redHarvestUid);
  const returningFlightUid = remapUid(uniqueGear.returningFlightUid);
  const lastArcheryUid = remapUid(uniqueGear.lastArcheryUid);
  if (
    redHarvestUid === uniqueGear.redHarvestUid &&
    returningFlightUid === uniqueGear.returningFlightUid &&
    lastArcheryUid === uniqueGear.lastArcheryUid
  ) {
    return uniqueGear;
  }
  return { ...uniqueGear, redHarvestUid, returningFlightUid, lastArcheryUid };
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

export function deliverPendingHandCards(state: BattleState): BattleState {
  const slots = Math.max(0, MAX_HAND_SIZE - state.hand.length);
  if (slots === 0 || state.pendingHandCards.length === 0) return state;
  return {
    ...state,
    hand: [...state.hand, ...state.pendingHandCards.slice(0, slots)],
    pendingHandCards: state.pendingHandCards.slice(slots),
  };
}

export function addCardToHandOrQueue(state: BattleState, card: BattleCard): BattleState {
  const ready = deliverPendingHandCards(state);
  const received = { ...card, uid: ready.nextCardUid };
  return ready.hand.length < MAX_HAND_SIZE
    ? { ...ready, hand: [...ready.hand, received], nextCardUid: ready.nextCardUid + 1 }
    : { ...ready, pendingHandCards: [...ready.pendingHandCards, received], nextCardUid: ready.nextCardUid + 1 };
}

export function drawCards(
  deck: BattleCard[],
  discard: BattleCard[],
  hand: BattleCard[],
  amount: number,
  nextCardUid: number,
  rng: () => number,
  pendingHandCards: BattleCard[] = [],
) {
  let nextDeck = [...deck];
  let nextDiscard = [...discard];
  const slots = Math.max(0, MAX_HAND_SIZE - hand.length);
  const nextHand = [...hand, ...pendingHandCards.slice(0, slots)];
  const nextPendingHandCards = pendingHandCards.slice(slots);
  let uid = nextCardUid;
  const uidChanges: CardUidChange[] = [];

  for (let i = 0; i < amount; i++) {
    const refilled = refillDeck(nextDeck, nextDiscard, rng);
    if (!refilled) break;
    nextDeck = refilled.deck;
    nextDiscard = refilled.discard;

    const card = nextDeck.pop();
    if (!card) break;
    const drawn = { ...card, uid };
    if (nextHand.length < MAX_HAND_SIZE) nextHand.push(drawn);
    else nextPendingHandCards.push(drawn);
    if (card.uid !== undefined) uidChanges.push({ previous: card.uid, next: uid });
    uid += 1;
  }

  return {
    deck: nextDeck,
    discard: nextDiscard,
    hand: nextHand,
    pendingHandCards: nextPendingHandCards,
    nextCardUid: uid,
    uidChanges,
  };
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
  return drawCards(
    state.deck,
    state.discard,
    state.hand,
    amount,
    state.nextCardUid,
    getBattleRng(state),
    state.pendingHandCards,
  );
}

export function applyDrawResult(state: BattleState, draw: ReturnType<typeof drawCards>): BattleState {
  return {
    ...state,
    deck: draw.deck,
    discard: draw.discard,
    hand: draw.hand,
    pendingHandCards: draw.pendingHandCards,
    nextCardUid: draw.nextCardUid,
    uniqueGear: remapDrawnCardBenefits(state, draw.uidChanges),
  };
}

export function drawKeywordCard(
  state: BattleState,
  keyword: string,
  options: { refillFromDiscard?: boolean } = {},
): BattleState {
  const ready = deliverPendingHandCards(state);
  // Twin-casting only tutors from the deck itself; ordinary draws reshuffle.
  const refilled =
    options.refillFromDiscard === false
      ? ready.deck.length > 0
        ? { deck: ready.deck, discard: ready.discard }
        : null
      : refillDeck(ready.deck, ready.discard, getBattleRng(ready));
  if (!refilled) return ready;
  const indices = refilled.deck.flatMap((card, index) => (cardHasKeyword(card, keyword) ? [index] : []));
  if (indices.length === 0) return ready;
  const sampled = indices[rngInt(getBattleRng(ready), indices.length)];
  if (sampled === undefined) return ready;
  const index = sampled;
  const deckCard = refilled.deck[index];
  if (!deckCard) return ready;
  const card = { ...deckCard, uid: ready.nextCardUid };
  return {
    ...ready,
    deck: refilled.deck.filter((_, i) => i !== index),
    discard: refilled.discard,
    hand: ready.hand.length < MAX_HAND_SIZE ? [...ready.hand, card] : ready.hand,
    pendingHandCards: ready.hand.length < MAX_HAND_SIZE ? ready.pendingHandCards : [...ready.pendingHandCards, card],
    nextCardUid: ready.nextCardUid + 1,
    uniqueGear: remapDrawnCardBenefits(ready, [{ previous: deckCard.uid, next: card.uid }]),
  };
}
