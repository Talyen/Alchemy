import { readCombatFlag } from "./action-context";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { mergeCombatText } from "./combat-text-events";
import type { BattleCard } from "@/lib/game-data";
import {
  type BattleResolution,
  type BattleState,
  type BattleSnapshot,
  type CombatFlags,
  type CombatTextEvent,
  isPlayerDefeated,
} from "./types";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import { deliverPendingHandCards } from "./draw";
import { applyPurgeGearRewards, purgeEnemyBenefits } from "./enemy-purge";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { finishUniqueCardDamage, prepareUniqueCardPlay } from "./unique-card-effects";
import { computeCardPayment } from "./card-cost-rules";
import { countRemovableHarmfulStatuses } from "./status-player";
import { isCcControlled } from "./status-cc";
import { applyResonantChimeTrinket, resolvePaidCardEffects, shouldElementalTalentRepeat } from "./card-play-effects";
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

function applySpellrendingPurge(state: BattleState, manaSpent: number, combatTexts: CombatTextEvent[]): BattleState {
  if (
    manaSpent <= 0 ||
    state.gearEffects.purgeOnFirstPaidCard <= 0 ||
    state.flags.spellrendingUsedThisTurn ||
    state.enemyHealth <= 0
  )
    return state;
  const ready = { ...state, flags: { ...state.flags, spellrendingUsedThisTurn: true } };
  const purged = purgeEnemyBenefits(ready, 1, combatTexts);
  return applyPurgeGearRewards(purged.state, purged.removed, combatTexts);
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
  if (!card.effects.some((effect) => effect.kind === "remove-harmful-status" || effect.kind === "remove-player-status"))
    return false;
  const hasUsefulEffect = card.effects.some(
    (effect) =>
      effect.kind !== "remove-harmful-status" &&
      effect.kind !== "remove-player-status" &&
      effect.kind !== "self-damage",
  );
  if (hasUsefulEffect) return false;
  return !card.effects.some((effect) =>
    effect.kind === "remove-harmful-status"
      ? (effect.removeAll === true || (effect.amount ?? 0) > 0) &&
        countRemovableHarmfulStatuses(state.playerStatuses) > 0
      : effect.kind === "remove-player-status" && state.playerStatuses[effect.status] > 0,
  );
}

function validateCardPlay(
  state: BattleSnapshot,
  card: BattleCard,
  index: number,
  options?: CardPlayOptions,
): ReturnType<typeof computeCardPayment> | null {
  if (!Number.isInteger(card.cost) || card.cost < 0) return null;
  if (state.enemyHealth <= 0 && !options?.allowAfterEnemyDefeat) return null;
  if (isPlayerDefeated(state)) return null;
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
  const combatTexts: CombatTextEvent[] = [];
  const enemyWasAlive = state.enemyHealth > 0;

  const card = getHandCard(state, cardId, index);
  if (!card) return { state, combatTexts };
  const payment = validateCardPlay(state, card, index, options);
  if (!payment) return { state, combatTexts };

  const freeMana =
    payment.effectiveCost > 0 &&
    (state.talentEffects.homesteadFreeManaChance ?? 0) > 0 &&
    rollPercent(state.talentEffects.homesteadFreeManaChance, getBattleRng(state));
  const effectiveCost = freeMana ? 0 : payment.effectiveCost;
  const blockCost = freeMana ? 0 : payment.blockCost;
  const costState = freeMana ? state : consumeCardDiscounts(state, payment);

  const existingPlayTwice = readCombatFlag(costState, "playNextCardTwice");
  const playTwice = existingPlayTwice || shouldElementalTalentRepeat(costState, card, existingPlayTwice);
  const prepared = prepareUniqueCardPlay(costState, card, effectiveCost);
  const paymentState = {
    ...prepared.state,
    playerStatuses: { ...prepared.state.playerStatuses, block: prepared.state.playerStatuses.block - blockCost },
  };
  const manaSpent = Math.min(paymentState.mana, effectiveCost);
  if (blockCost > 0)
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockCost, impact: false });
  const stripped: BattleState = {
    ...paymentState,
    hand: paymentState.hand.filter((_, handIndex) => handIndex !== index),
    flags: { ...paymentState.flags, playNextCardTwice: false },
    cardsPlayedThisTurn: paymentState.cardsPlayedThisTurn + 1,
    mana: Math.max(0, paymentState.mana - effectiveCost),
  };
  const paid = applySpellrendingPurge(stripped, manaSpent, combatTexts);
  const played = resolvePaidCardEffects(deliverPendingHandCards(paid), card, combatTexts, {
    eligibility: state,
    playTwice,
    guaranteedCrit: prepared.critical,
    damageEffects: prepared.damageEffects,
    manaAtStart: paymentState.mana,
    enemyFreezeSkipTurnsAtStart: paymentState.enemyCC.freezeSkipTurns,
    hadNoThornsOnPlay: state.playerStatuses.thorns === 0,
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
  return { state: resolvePendingBattleReactions(nextState, combatTexts), combatTexts };
}
