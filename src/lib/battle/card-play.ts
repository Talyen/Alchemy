import { applyEmergencyWishForEmptyDraw } from "./wish";
import { readCombatFlag } from "./action-context";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { mergeCombatText } from "./combat-text-events";
import { harmfulPlayerStatusIds, type BattleCard } from "@/lib/game-data";
import type { BattleResolution, BattleState, BattleSnapshot, CombatFlags, CombatTextEvent } from "./types";
import { getBattleOutcome, isPlayerDefeated } from "./battle-outcome";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import { deliverPendingHandCards } from "./draw";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { finishUniqueCardDamage, prepareUniqueCardPlay } from "./unique-card-effects";
import { computeCardPayment } from "./card-cost-rules";
import { countRemovableHarmfulStatuses } from "./status-player";
import { isCcControlled } from "./status-cc";
import { applyResonantChimeTrinket, resolveCardEffectChain, shouldElementalTalentRepeat } from "./card-play-effects";
import { cardHasKeyword } from "./card-classification";
import { applyBlockReward, gainManaWithCombatText } from "./player-rewards";
import { handlePostPlayCardDestination } from "./card-consume";

function consumeCardDiscounts(state: BattleState, payment: ReturnType<typeof computeCardPayment>): BattleState {
  const { consumedFlags, disarmedFlags, spentArmedDiscount, uniqueDiscounts } = payment;
  if (
    consumedFlags.size === 0 &&
    disarmedFlags.size === 0 &&
    !spentArmedDiscount &&
    Object.keys(uniqueDiscounts).length === 0
  ) {
    return state;
  }
  const nextFlags: CombatFlags = { ...state.flags };
  for (const flag of consumedFlags) nextFlags[flag] = true;
  for (const flag of disarmedFlags) nextFlags[flag] = false;
  if (spentArmedDiscount) nextFlags.nextCardCostReduction = 0;
  return { ...state, flags: nextFlags, uniqueGear: { ...state.uniqueGear, ...uniqueDiscounts } };
}

function getHandCard(state: BattleSnapshot, cardId: string, index: number, uid?: number): BattleCard | null {
  if (state.wishOptions) return null;
  const card = state.hand[index];
  if (!card || card.id !== cardId) return null;
  if (uid !== undefined && card.uid !== uid) return null;
  return card;
}

export interface CardPlayOptions {
  allowAfterEnemyDefeat?: boolean;
}

function cleanseOnlyCardHasNoTargets(card: BattleCard, state: BattleSnapshot): boolean {
  let hasCleanse = false;
  let hasCleanseTarget = false;
  const createdStatuses = new Set<string>();

  for (const effect of card.effects) {
    if (effect.kind === "remove-harmful-status") {
      hasCleanse = true;
      if (
        !hasCleanseTarget &&
        (effect.removeAll === true || (effect.amount ?? 0) > 0) &&
        (countRemovableHarmfulStatuses(state.playerStatuses) > 0 || createdStatuses.size > 0)
      ) {
        hasCleanseTarget = true;
      }
    } else if (effect.kind === "remove-player-status") {
      hasCleanse = true;
      if (!hasCleanseTarget && (state.playerStatuses[effect.status] > 0 || createdStatuses.has(effect.status))) {
        hasCleanseTarget = true;
      }
    } else if (effect.kind === "self-damage") {
      // A preceding typed cost can create the status this card cleanses.
      if (effect.amount > 0 && harmfulPlayerStatusIds.some((status) => status === effect.damageType))
        createdStatuses.add(effect.damageType);
    } else {
      return false;
    }
  }

  return hasCleanse && !hasCleanseTarget;
}

function validateCardPlay(
  state: BattleSnapshot,
  card: BattleCard,
  index: number,
  options?: CardPlayOptions,
): ReturnType<typeof computeCardPayment> | null {
  if (!Number.isInteger(card.cost) || card.cost < 0) return null;
  const outcome = getBattleOutcome(state);
  if (outcome === "defeat" || (outcome === "victory" && !options?.allowAfterEnemyDefeat)) return null;
  if (state.turnPhase !== "player") return null;
  if (isCcControlled(state.playerCC)) return null;
  const handCard = getHandCard(state, card.id, index, card.uid);
  if (!handCard) return null;
  const payment = computeCardPayment(state, handCard);
  if (!payment.affordable) return null;
  if (cleanseOnlyCardHasNoTargets(card, state)) return null;
  return payment;
}

// UI highlighting, auto-end-turn, and autoplay inspect the same immutable
// snapshot. Keep only boolean previews; payment objects stay freshly owned by
// resolution, and weak keys do not retain completed battles or old hands.
const playableCards = new WeakMap<BattleSnapshot, Map<number, boolean>>();

export function canPlayCard(
  state: BattleSnapshot,
  card: BattleCard,
  index: number,
  options?: CardPlayOptions,
): boolean {
  // A caller-supplied wrapper may have different costs or effects from the hand.
  // Preserve its validation behavior without putting it in the snapshot cache.
  if (!Number.isInteger(index) || index < 0 || state.hand[index] !== card) {
    return validateCardPlay(state, card, index, options) !== null;
  }
  const key = index * 2 + (options?.allowAfterEnemyDefeat ? 1 : 0);
  let previews = playableCards.get(state);
  const cached = previews?.get(key);
  if (cached !== undefined) return cached;
  const playable = validateCardPlay(state, card, index, options) !== null;
  if (!previews) {
    previews = new Map();
    playableCards.set(state, previews);
  }
  previews.set(key, playable);
  return playable;
}

export function playBattleCardResolved(
  state: BattleState,
  cardId: string,
  index: number,
  options?: CardPlayOptions,
): BattleResolution {
  const card = getHandCard(state, cardId, index);
  const payment = card && validateCardPlay(state, card, index, options);
  if (!card || !payment) return { state, combatTexts: [] };
  return resolveCardPlay(state, card, index, payment);
}

/** Hypothetical admission only. The same payment and action recipe owns all consequences. */
export function resolveInspectedCardPlay(
  state: BattleState & { observer: NonNullable<BattleState["observer"]> },
  card: BattleCard,
  handIndex: number,
): BattleResolution {
  return resolveCardPlay(state, card, handIndex, computeCardPayment(state, card));
}

function resolveCardPlay(
  state: BattleState,
  card: BattleCard,
  index: number,
  payment: ReturnType<typeof computeCardPayment>,
): BattleResolution {
  const combatTexts: CombatTextEvent[] = [];
  const enemyWasAlive = state.enemyHealth > 0;
  // An Emergency Wish is a nested action; its retaliation precedes the interrupted hit's healing.
  const previousEmptyDraw = state.onEmptyDraw;
  state = {
    ...state,
    onEmptyDraw:
      previousEmptyDraw ??
      ((current, amount, texts) =>
        resolvePendingBattleReactions(applyEmergencyWishForEmptyDraw(current, amount, texts), texts)),
  };

  const freeMana =
    payment.effectiveCost > 0 &&
    (state.talentEffects.homesteadFreeManaChance ?? 0) > 0 &&
    rollPercent(state.talentEffects.homesteadFreeManaChance, getBattleRng(state));
  const effectiveCost = freeMana ? 0 : payment.effectiveCost;
  const blockCost = freeMana ? 0 : payment.blockCost;
  const costState = freeMana ? state : consumeCardDiscounts(state, payment);

  const existingPlayTwice = readCombatFlag(costState, "playNextCardTwice");
  const playTwice = existingPlayTwice || shouldElementalTalentRepeat(costState, card);
  const prepared = prepareUniqueCardPlay(costState, card, effectiveCost);
  const paymentState = {
    ...prepared.state,
    playerStatuses: {
      ...prepared.state.playerStatuses,
      block: Math.max(0, prepared.state.playerStatuses.block - blockCost),
    },
  };
  const manaSpent = Math.min(paymentState.mana, effectiveCost);
  if (blockCost > 0)
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockCost, impact: false });
  let stripped: BattleState = {
    ...paymentState,
    hand: paymentState.hand.filter((_, handIndex) => handIndex !== index),
    flags: { ...paymentState.flags, playNextCardTwice: false },
    cardsPlayedThisTurn: paymentState.cardsPlayedThisTurn + 1,
    mana: Math.max(0, paymentState.mana - effectiveCost),
  };
  if (manaSpent > 0 && state.playerStatuses.block === 0 && state.gearEffects.blockOnPaidCardWithoutBlock > 0) {
    stripped = applyBlockReward(stripped, state.gearEffects.blockOnPaidCardWithoutBlock, combatTexts);
  }
  const played = resolveCardEffectChain(deliverPendingHandCards(stripped), card, combatTexts, {
    eligibility: state,
    playedCard: true,
    playTwice,
    guaranteedCrit: prepared.critical,
    damageEffects: prepared.damageEffects,
    manaAtStart: paymentState.mana,
  });
  let nextState = finishUniqueCardDamage(played.state, card, prepared, combatTexts);
  nextState = processEncounterTraitCardAction(nextState, card, combatTexts, played.attackAttempted);
  if (playTwice)
    nextState = processEncounterTraitCardAction(
      nextState,
      { ...card, consume: false },
      combatTexts,
      played.repeatAttackAttempted,
      { cardPlayed: false },
    );

  if (!isPlayerDefeated(nextState) && state.talentEffects.wishCardRefundsMana && cardHasKeyword(card, "wish")) {
    nextState = gainManaWithCombatText(nextState, manaSpent, combatTexts, { skipFightPacing: true });
  }
  const playerAlive = !isPlayerDefeated(nextState);
  if (playerAlive && enemyWasAlive) {
    nextState = applyResonantChimeTrinket(nextState, combatTexts);
  }
  nextState = handlePostPlayCardDestination(nextState, card, {
    triggerConsumeRiders: playerAlive,
    combatTexts,
    lastCardInHand: state.hand.length === 1,
    manaSpent,
  });
  const resolved = resolvePendingBattleReactions(nextState, combatTexts);
  // Payment, pre-play talents and post-play rewards share this action's receipt,
  // but only the effect interpreter can mark an intended card outcome as primary.
  for (const event of combatTexts) event.feedback ??= "secondary";
  if (previousEmptyDraw) return { state: resolved, combatTexts };
  const { onEmptyDraw: _onEmptyDraw, ...completed } = resolved;
  return { state: completed, combatTexts };
}
