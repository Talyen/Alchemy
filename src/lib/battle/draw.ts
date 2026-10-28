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
  if (
    changes.length === 0 ||
    (state.uniqueGear.returningFlightUids.length === 0 && state.uniqueGear.lastArcheryUid === null)
  )
    return state.uniqueGear;
  // Echoed archery cards need no remap: echoes replay by reference, not by uid.
  const remappedUids = new Map<number, number>();
  for (const { previous, next } of changes) {
    // Match the first draw if malformed input repeats an old UID.
    if (previous !== undefined && !remappedUids.has(previous)) remappedUids.set(previous, next);
  }
  const remapUid = (uid: number | null) => (uid === null ? null : (remappedUids.get(uid) ?? uid));
  const uniqueGear = state.uniqueGear;
  let returningFlightUids = uniqueGear.returningFlightUids;
  for (let index = 0; index < uniqueGear.returningFlightUids.length; index++) {
    const uid = uniqueGear.returningFlightUids[index]!;
    const remapped = remapUid(uid)!;
    if (remapped !== uid) {
      if (returningFlightUids === uniqueGear.returningFlightUids) returningFlightUids = [...returningFlightUids];
      returningFlightUids[index] = remapped;
    }
  }
  const lastArcheryUid = remapUid(uniqueGear.lastArcheryUid);
  if (returningFlightUids === uniqueGear.returningFlightUids && lastArcheryUid === uniqueGear.lastArcheryUid)
    return uniqueGear;
  return { ...uniqueGear, returningFlightUids, lastArcheryUid };
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

export function refillEmptyDrawPile(state: BattleState): BattleState {
  if (state.deck.length > 0 || state.discard.length === 0) return state;
  return { ...state, deck: shuffle(state.discard, getBattleRng(state)), discard: [] };
}

function distributeHandCards(hand: BattleCard[], queued: BattleCard[]) {
  const slots = Math.max(0, MAX_HAND_SIZE - hand.length);
  const delivered = Math.min(slots, queued.length);
  if (delivered === 0) return { hand, pendingHandCards: queued };
  const nextHand = [...hand];
  for (let index = 0; index < delivered; index++) nextHand.push(queued[index]!);
  return { hand: nextHand, pendingHandCards: queued.slice(slots) };
}

export function deliverPendingHandCards(state: BattleState): BattleState {
  if (state.hand.length >= MAX_HAND_SIZE || state.pendingHandCards.length === 0) return state;
  return { ...state, ...distributeHandCards(state.hand, state.pendingHandCards) };
}

export function addCardToHandOrQueue(state: BattleState, card: BattleCard): BattleState {
  const received = { ...card, uid: state.nextCardUid };
  const slots = Math.max(0, MAX_HAND_SIZE - state.hand.length);
  const hand = slots > 0 ? [...state.hand] : state.hand;
  const pendingHandCards = state.pendingHandCards.slice(slots);
  const delivered = Math.min(slots, state.pendingHandCards.length);
  for (let index = 0; index < delivered; index++) hand.push(state.pendingHandCards[index]!);
  if (slots > state.pendingHandCards.length) hand.push(received);
  else pendingHandCards.push(received);
  return { ...state, hand, pendingHandCards, nextCardUid: state.nextCardUid + 1 };
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

  const refilled =
    amount > 0 && nextDeck.length === 0 && nextDiscard.length > 0 ? refillDeck(nextDeck, nextDiscard, rng) : null;
  return {
    deck: refilled?.deck ?? nextDeck,
    discard: refilled?.discard ?? nextDiscard,
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
  if (state.deck.length > 0 || state.discard.length > 0) state.observer?.unknownDraw();
  const battleRng = getBattleRng(state);
  const refilled = refillDeck(state.deck, state.discard, battleRng);
  if (!refilled || refilled.deck.length === 0) return null;
  // A reshuffle already returned an owned deck; copy only an existing pile.
  const deck = refilled.deck === state.deck ? [...refilled.deck] : refilled.deck;
  const rawCard = takeRandomItem(deck, battleRng);
  if (!rawCard) return null;
  const remaining = refillDeck(deck, refilled.discard, battleRng);
  return {
    card: { ...rawCard, uid: state.nextCardUid },
    deck: remaining?.deck ?? deck,
    discard: remaining?.discard ?? refilled.discard,
    nextCardUid: state.nextCardUid + 1,
    uniqueGear: remapDrawnCardBenefits(state, [{ previous: rawCard.uid, next: state.nextCardUid }]),
  };
}

export function drawFromState(state: BattleState, amount: number) {
  if (amount > 0 && (state.deck.length > 0 || state.discard.length > 0)) state.observer?.unknownDraw();
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

function reportDraw(
  state: BattleState,
  nextState: BattleState,
  combatTexts?: CombatTextEvent[],
  feedback?: CombatTextEvent["feedback"],
): BattleState {
  const received =
    nextState.hand.length + nextState.pendingHandCards.length - state.hand.length - state.pendingHandCards.length;
  if (received > 0 && combatTexts) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "draw",
      amount: received,
      ...(feedback ? { feedback } : {}),
    });
  }
  return nextState;
}

export function applyDrawResult(
  state: BattleState,
  draw: ReturnType<typeof drawCards>,
  combatTexts?: CombatTextEvent[],
  feedback?: CombatTextEvent["feedback"],
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
    feedback,
  );
}

export function drawKeywordCard(
  state: BattleState,
  keyword: string,
  options: { refillFromDiscard?: boolean; combatTexts?: CombatTextEvent[] } = {},
): BattleState {
  const ready = deliverPendingHandCards(state);
  const readyRng = getBattleRng(ready);
  // Twin-casting does not refill before looking for an eligible card.
  const refilled =
    options.refillFromDiscard === false
      ? ready.deck.length > 0
        ? { deck: ready.deck, discard: ready.discard }
        : null
      : refillDeck(ready.deck, ready.discard, readyRng);
  if (!refilled) return ready;
  const indices: number[] = [];
  for (let index = 0; index < refilled.deck.length; index++) {
    if (cardHasKeyword(refilled.deck[index]!, keyword)) indices.push(index);
  }
  if (indices.length === 0) return { ...ready, deck: refilled.deck, discard: refilled.discard };
  state.observer?.unknownDraw();
  const sampled = indices[rngInt(readyRng, indices.length)];
  if (sampled === undefined) return { ...ready, deck: refilled.deck, discard: refilled.discard };
  const index = sampled;
  const deckCard = refilled.deck[index];
  if (!deckCard) return { ...ready, deck: refilled.deck, discard: refilled.discard };
  const card = { ...deckCard, uid: ready.nextCardUid };
  const remainingDeck = refilled.deck === ready.deck ? [...refilled.deck] : refilled.deck;
  remainingDeck.splice(index, 1);
  const remaining = refillDeck(remainingDeck, refilled.discard, readyRng);
  return reportDraw(
    ready,
    {
      ...ready,
      deck: remaining?.deck ?? remainingDeck,
      discard: remaining?.discard ?? refilled.discard,
      ...distributeHandCards(ready.hand, [...ready.pendingHandCards, card]),
      nextCardUid: ready.nextCardUid + 1,
      uniqueGear: remapDrawnCardBenefits(ready, [{ previous: deckCard.uid, next: card.uid }]),
    },
    options.combatTexts,
  );
}
