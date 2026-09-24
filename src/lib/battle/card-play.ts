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
  const purged = purgeEnemyBenefits(ready, ready.gearEffects.purgeOnFirstPaidCard, combatTexts);
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

function cardHasOnlyCleanseEffect(card: BattleCard, state: BattleSnapshot): boolean {
  if (!card.effects.some((effect) => effect.kind === "remove-harmful-status")) return false;
  const hasUsefulEffect = card.effects.some(
    (effect) => effect.kind !== "remove-harmful-status" && effect.kind !== "self-damage",
  );
  return !hasUsefulEffect && countRemovableHarmfulStatuses(state.playerStatuses) === 0;
}

function validateCardPlay(
  state: BattleSnapshot,
  card: BattleCard,
  index: number,
  options?: CardPlayOptions,
): ReturnType<typeof computeCardPayment> | null {
  if (state.enemyHealth <= 0 && !options?.allowAfterEnemyDefeat) return null;
  if (isPlayerDefeated(state)) return null;
  if (state.turnPhase !== "player") return null;
  if (isCcControlled(state.playerCC)) return null;
  const handCard = getHandCard(state, card.id, index, card.uid);
  if (!handCard) return null;
  const payment = computeCardPayment(state, handCard);
  if (!payment.affordable) return null;
  if (cardHasOnlyCleanseEffect(card, state)) return null;
  return payment;
}

export function canPlayCard(
  state: BattleSnapshot,
  card: BattleCard,
  index: number,
  options?: CardPlayOptions,
): boolean {
  return validateCardPlay(state, card, index, options) !== null;
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
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockCost });
  const stripped: BattleState = {
    ...paymentState,
    hand: paymentState.hand.filter((_, handIndex) => handIndex !== index),
    flags: { ...paymentState.flags, playNextCardTwice: false },
    cardsPlayedThisTurn: paymentState.cardsPlayedThisTurn + 1,
    mana: Math.max(0, paymentState.mana - effectiveCost),
  };
  const paid = applySpellrendingPurge(stripped, manaSpent, combatTexts);
  const played = resolvePaidCardEffects(deliverPendingHandCards(paid), card, combatTexts, {
    playTwice,
    guaranteedCrit: prepared.critical,
    damageEffects: prepared.damageEffects,
    manaAtStart: paymentState.mana,
    enemyFreezeSkipTurnsAtStart: paymentState.enemyCC.freezeSkipTurns,
    hadNoThornsOnPlay: paymentState.playerStatuses.thorns === 0,
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
