import { drawCards } from "./draw";
import { applyCardEffects, mergeCombatText } from "./effects";
import { cardsPerTurn, maxHandSize, type BattleResolution, type BattleState, type CombatTextEvent, type TurnPhase } from "./types";

// Entry point for playing a card. Validates mana/wish state, finds the card in hand,
// deducts mana, applies effects, then routes to discard or exhaust.
// We filter hand by index rather than splice because BattleState is immutable —
// filter creates a new array without mutating the original.
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

  // Consumed cards go to exhausted (removed for the battle) instead of discard.
  // This is the game's version of "exile" — key for balancing powerful one-shot effects
  // that shouldn't cycle back into the deck via discard reshuffle.
  if (card.consume) {
    return { state: { ...nextState, exhausted: [...nextState.exhausted, card] }, combatTexts };
  }

  return { state: { ...nextState, discard: [...nextState.discard, card] }, combatTexts };
}

// ----- DoT tick functions -----
// Each status ticks independently and is a pure state transformer. Burn halves each
// turn (diminishing returns), poison decrements by 1 (linear decay), and bleed resets
// to 0 after ticking (burst damage). The leech variant of bleed also heals the player
// for the bleed amount when it ticks.

function tickBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.burn;
  if (damage <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: damage });
  return { ...state, enemyHealth: Math.max(0, Math.min(30, state.enemyHealth - damage)), enemyStatuses: { ...state.enemyStatuses, burn: Math.floor(state.enemyStatuses.burn / 2) } };
}

function tickPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.poison;
  if (damage <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "poison", amount: damage });
  return { ...state, enemyHealth: Math.max(0, Math.min(30, state.enemyHealth - damage)), enemyStatuses: { ...state.enemyStatuses, poison: Math.max(0, state.enemyStatuses.poison - 1) } };
}

function tickBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.bleed;
  if (damage <= 0) return state;
  let nextState = { ...state, enemyHealth: Math.max(0, Math.min(30, state.enemyHealth - damage)), enemyStatuses: { ...state.enemyStatuses, bleed: 0, bleedLeech: 0 } };
  if (state.enemyStatuses.bleedLeech > 0) {
    nextState.playerHealth = Math.max(0, Math.min(30, nextState.playerHealth + damage));
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: damage });
  }
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "bleed", amount: damage });
  return nextState;
}

function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = tickBurn(state, combatTexts);
  nextState = tickPoison(nextState, combatTexts);
  nextState = tickBleed(nextState, combatTexts);
  return nextState;
}

// Wish card resolution: finds the chosen card in wishOptions and puts it into
// the player's hand (if there's room) or discard (if hand is full). The hand-full
// fallback prevents a softlock where a full hand would cause the card to vanish.
export function chooseWishCard(state: BattleState, cardId: string) {
  const chosenCard = state.wishOptions?.find((card) => card.id === cardId);
  if (!chosenCard) {
    return state;
  }

  if (state.hand.length < maxHandSize) {
    return { ...state, hand: [...state.hand, chosenCard], wishOptions: null };
  }

  return { ...state, discard: [...state.discard, chosenCard], wishOptions: null };
}

// ----- Enemy turn helpers -----

// Advances the battle to the next player turn. Draws a fresh hand from the deck
// (shuffling discard into deck if needed), halves remaining block, and resets mana.
// Block halves each turn regardless of whether the enemy attacked — this prevents
// infinite block stacking across multiple turns.
function advanceToPlayerTurn(state: BattleState) {
  const nextDraw = drawCards(state.deck, state.discard, [], cardsPerTurn);
  return {
    ...state,
    turn: state.turn + 1,
    turnPhase: "player" as TurnPhase,
    deck: nextDraw.deck,
    hand: nextDraw.hand,
    discard: [],
    mana: state.maxMana,
    playerStatuses: { ...state.playerStatuses, block: Math.floor((state.playerStatuses.block ?? 0) / 2) },
  };
}

// Enemy attacks the player. Block absorbs damage first (and shows a "-X block"
// floating text), then armor provides flat reduction. Order matters: block before
// armor means block is the "first line" that completely stops damage up to its
// value, while armor reduces whatever gets through.
function processEnemyAttack(state: BattleState, combatTexts: CombatTextEvent[]) {
  let remainingDamage = state.enemyAttack;
  const blockAbsorb = Math.min(remainingDamage, state.playerStatuses.block);
  remainingDamage -= blockAbsorb;

  if (blockAbsorb > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockAbsorb });
  }

  const actualDamage = Math.max(0, remainingDamage - state.playerStatuses.armor);

  if (actualDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "health", amount: actualDamage });
  }

  return {
    ...state,
    playerHealth: Math.max(0, Math.min(30, state.playerHealth - actualDamage)),
    playerStatuses: {
      ...state.playerStatuses,
      block: state.playerStatuses.block - blockAbsorb,
    },
  };
}

// End-turn resolution: this is called when the player clicks "End Turn".
// The function computes the entire enemy phase deterministically so the controller
// can animate it in two phases: (1) show "Enemy Turn" + DoT ticks immediately,
// then (2) apply the attack + draw after a delay.
export function endPlayerTurn(state: BattleState): { state: BattleState; combatTexts: CombatTextEvent[] } {
  const combatTexts: CombatTextEvent[] = [];

  let nextState: BattleState = {
    ...state,
    turnPhase: "enemy" as TurnPhase,
    hand: [],
    discard: [...state.discard, ...state.hand],
  };

  // If the enemy is stunned, skip the entire enemy phase — no attack, no DoT ticks.
  // The player still draws a new hand and their block still halves.
  if (state.enemySkipTurns > 0) {
    nextState = { ...nextState, enemySkipTurns: state.enemySkipTurns - 1 };
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "stun", amount: 0 });
    return { state: advanceToPlayerTurn(nextState), combatTexts };
  }

  // DoTs tick first — if they kill the enemy, the battle ends before the enemy attacks.
  // This makes DoT builds viable (you can kill on your opponent's turn).
  nextState = tickEnemyStatuses(nextState, combatTexts);

  if (nextState.enemyHealth <= 0) {
    return { state: advanceToPlayerTurn(nextState), combatTexts };
  }

  // Normal attack sequence.
  nextState = processEnemyAttack(nextState, combatTexts);
  return { state: advanceToPlayerTurn(nextState), combatTexts };
}
