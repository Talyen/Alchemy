import { applyEmergencyWishForEmptyDraw } from "./wish";
import { readCombatFlag } from "./action-context";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { mergeCombatText } from "./combat-text-events";
import { harmfulPlayerStatusIds, type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import type { BattleResolution, BattleState, BattleSnapshot, CombatFlags, CombatTextEvent } from "./types";
import { getBattleOutcome, isPlayerDefeated } from "./battle-outcome";
import { processEncounterTraitsForCardCopies } from "./encounter-trait-events";
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
import { applyPotionMultiplier, cardPotionMultiplier } from "./amount-helpers";
import { scaleGoldReward } from "./resource-state";

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
  let createdStatuses: Set<string> | undefined;

  for (const effect of card.effects) {
    if (effect.kind === "remove-harmful-status") {
      hasCleanse = true;
      if (
        !hasCleanseTarget &&
        (effect.removeAll === true || (effect.amount ?? 0) > 0) &&
        ((createdStatuses?.size ?? 0) > 0 || countRemovableHarmfulStatuses(state.playerStatuses) > 0)
      ) {
        hasCleanseTarget = true;
      }
    } else if (effect.kind === "remove-player-status") {
      hasCleanse = true;
      if (!hasCleanseTarget && (state.playerStatuses[effect.status] > 0 || createdStatuses?.has(effect.status))) {
        hasCleanseTarget = true;
      }
    } else if (effect.kind === "self-damage") {
      // A preceding typed cost can create the status this card cleanses.
      if (effect.amount > 0 && harmfulPlayerStatusIds.includes(effect.damageType))
        (createdStatuses ??= new Set()).add(effect.damageType);
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
  if (!handCard || !Number.isInteger(handCard.cost) || handCard.cost < 0) return null;
  const payment = computeCardPayment(state, handCard);
  if (!payment.affordable) return null;
  if (cleanseOnlyCardHasNoTargets(card, state) || (card !== handCard && cleanseOnlyCardHasNoTargets(handCard, state)))
    return null;
  return payment;
}

// UI highlighting, auto-end-turn, and autoplay inspect the same immutable
// snapshot. Keep only boolean previews; payment objects stay freshly owned by
// resolution, and weak keys do not retain completed battles or old hands.
const playableCards = new WeakMap<BattleSnapshot, Map<number, boolean>>();

const resolveEmptyDraw: NonNullable<BattleState["onEmptyDraw"]> = (current, amount, texts) =>
  resolvePendingBattleReactions(applyEmergencyWishForEmptyDraw(current, amount, texts), texts);

export function canPlayCard(
  state: BattleSnapshot,
  card: BattleCard,
  index: number,
  options?: CardPlayOptions,
): boolean {
  // A caller-supplied wrapper may have different costs or effects from the hand.
  // Validate both it and the current hand without caching a stale wrapper.
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
  // These nominal capacities cannot depend on unknown drawn identities. Record
  // their shared production scaling before a draw stops the inspected action.
  const potionMultiplier = cardPotionMultiplier(state, card);
  const observeIndependent = (effects: readonly BattleCardEffect[]) => {
    for (const effect of effects) {
      if (effect.kind === "chance") {
        observeIndependent(effect.successEffects);
        observeIndependent(effect.failureEffects);
      } else if (effect.kind === "wish" || effect.kind === "draw-cards" || effect.kind === "companion-action")
        state.observer.descriptionMagnitude?.("amount", applyPotionMultiplier(effect.amount, potionMultiplier), effect);
      else if (
        (effect.kind === "remove-harmful-status" && !effect.removeAll && effect.amount !== undefined) ||
        (effect.kind === "remove-enemy-armor" && !effect.removeAll && !effect.halve && effect.amount !== undefined)
      )
        state.observer.descriptionMagnitude?.("amount", applyPotionMultiplier(effect.amount, potionMultiplier), effect);
      else if (effect.kind === "gain-gold")
        state.observer.descriptionMagnitude?.(
          "amount",
          scaleGoldReward(applyPotionMultiplier(effect.amount, potionMultiplier), state.gearEffects),
          effect,
        );
    }
  };
  observeIndependent(card.effects);
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
    onEmptyDraw: previousEmptyDraw ?? resolveEmptyDraw,
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
    cardsPlayedThisTurn: Math.min(Number.MAX_SAFE_INTEGER, paymentState.cardsPlayedThisTurn + 1),
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
  nextState = processEncounterTraitsForCardCopies(
    nextState,
    card,
    combatTexts,
    played.attackAttempted,
    playTwice ? played.repeatAttackAttempted : undefined,
  );

  if (!isPlayerDefeated(nextState) && state.talentEffects.wishCardRefundsMana && cardHasKeyword(card, "wish")) {
    nextState = resolvePendingBattleReactions(
      gainManaWithCombatText(nextState, manaSpent, combatTexts, { skipFightPacing: true }),
      combatTexts,
    );
  }
  if (!isPlayerDefeated(nextState) && enemyWasAlive) {
    nextState = resolvePendingBattleReactions(applyResonantChimeTrinket(nextState, combatTexts), combatTexts);
  }
  // Mana restoration can retaliate through healing; settle it before Consume
  // draws can grant an Emergency Wish that defeats the enemy and cancels that hit.
  const playerAlive = !isPlayerDefeated(nextState);
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
