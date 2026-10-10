import type { BattleCard } from "@/lib/game-data";
import { cardHasKeyword } from "./card-classification";
import { getBattleRng, rngInt, shuffle, takeRandomItem } from "@/lib/rng";
import type { BattleState, CombatTextEvent } from "./types";
import { mergeCombatText } from "./combat-text-events";
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
  const returningFlightUid = remapUid(uniqueGear.returningFlightUid);
  const lastArcheryUid = remapUid(uniqueGear.lastArcheryUid);
  if (returningFlightUid === uniqueGear.returningFlightUid && lastArcheryUid === uniqueGear.lastArcheryUid) {
    return uniqueGear;
  }
  return { ...uniqueGear, returningFlightUid, lastArcheryUid };
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

function distributeHandCards(hand: BattleCard[], queued: BattleCard[]) {
  const slots = Math.max(0, MAX_HAND_SIZE - hand.length);
  return { hand: [...hand, ...queued.slice(0, slots)], pendingHandCards: queued.slice(slots) };
}

export function deliverPendingHandCards(state: BattleState): BattleState {
  if (state.hand.length >= MAX_HAND_SIZE || state.pendingHandCards.length === 0) return state;
  return { ...state, ...distributeHandCards(state.hand, state.pendingHandCards) };
}

export function addCardToHandOrQueue(state: BattleState, card: BattleCard): BattleState {
  const received = { ...card, uid: state.nextCardUid };
  return {
    ...state,
    ...distributeHandCards(state.hand, [...state.pendingHandCards, received]),
    nextCardUid: state.nextCardUid + 1,
  };
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
  // Only the deck is mutated. shuffle() owns a fresh array when refilling,
  // so the untouched discard can stay shared with the immutable input state.
  let nextDiscard = discard;
  const queuedCards = [...pendingHandCards];
  let uid = nextCardUid;
  const uidChanges: CardUidChange[] = [];

  for (let i = 0; i < amount; i++) {
    if (nextDeck.length === 0) {
      const refilled = refillDeck(nextDeck, nextDiscard, rng);
      if (!refilled) break;
      nextDeck = refilled.deck;
      nextDiscard = refilled.discard;
    }

    const card = nextDeck.pop();
    if (!card) break;
    const drawn = { ...card, uid };
    queuedCards.push(drawn);
    if (card.uid !== undefined) uidChanges.push({ previous: card.uid, next: uid });
    uid += 1;
  }

  return {
    deck: nextDeck,
    discard: nextDiscard,
    ...distributeHandCards(hand, queuedCards),
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
  // A reshuffle already returned an owned deck; copy only an existing pile.
  const deck = refilled.deck === state.deck ? [...refilled.deck] : refilled.deck;
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

function reportDraw(state: BattleState, nextState: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  const received =
    nextState.hand.length + nextState.pendingHandCards.length - state.hand.length - state.pendingHandCards.length;
  if (received > 0 && combatTexts) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "draw", amount: received });
  }
  return nextState;
}

export function applyDrawResult(
  state: BattleState,
  draw: ReturnType<typeof drawCards>,
  combatTexts?: CombatTextEvent[],
): BattleState {
  return reportDraw(
    state,
    {
      ...state,
      deck: draw.deck,
      discard: draw.discard,
      hand: draw.hand,
      pendingHandCards: draw.pendingHandCards,
      nextCardUid: draw.nextCardUid,
      uniqueGear: remapDrawnCardBenefits(state, draw.uidChanges),
    },
    combatTexts,
  );
}

export function drawKeywordCard(
  state: BattleState,
  keyword: string,
  options: { refillFromDiscard?: boolean; combatTexts?: CombatTextEvent[] } = {},
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
  const indices: number[] = [];
  for (let index = 0; index < refilled.deck.length; index++) {
    if (cardHasKeyword(refilled.deck[index]!, keyword)) indices.push(index);
  }
  if (indices.length === 0) return { ...ready, deck: refilled.deck, discard: refilled.discard };
  const sampled = indices[rngInt(getBattleRng(ready), indices.length)];
  if (sampled === undefined) return { ...ready, deck: refilled.deck, discard: refilled.discard };
  const index = sampled;
  const deckCard = refilled.deck[index];
  if (!deckCard) return { ...ready, deck: refilled.deck, discard: refilled.discard };
  const card = { ...deckCard, uid: ready.nextCardUid };
  return reportDraw(
    ready,
    {
      ...ready,
      deck: refilled.deck.filter((_, i) => i !== index),
      discard: refilled.discard,
      ...distributeHandCards(ready.hand, [...ready.pendingHandCards, card]),
      nextCardUid: ready.nextCardUid + 1,
      uniqueGear: remapDrawnCardBenefits(ready, [{ previous: deckCard.uid, next: card.uid }]),
    },
    options.combatTexts,
  );
}
