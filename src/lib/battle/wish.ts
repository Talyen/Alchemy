import { upgradeWishCard } from "./wish-upgrade";
import { applyDamageStatuses } from "./damage-status-riders";
import { rollBattleChance } from "./chance-roll";
import { resolveBattleSequence, type ReactionBoundary } from "./battle-sequence";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { hasEncounterBenefit, hasEnemyTrait } from "./encounter-trait-state";
import { selectRewardCards } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import type { BattleCard } from "@/lib/game-data";
import { addCardToHandOrQueue, applyDrawResult, drawFromState } from "./draw";
import type { BattleState, CombatTextEvent } from "./types";
import { getBattleOutcome } from "./battle-outcome";
import {
  addGoldWithCombatText,
  applyHealingWithCombatText,
  applyHitEpilogue,
  gainManaWithCombatText,
} from "./player-rewards";
import {
  removeHarmfulPlayerStatuses,
  applyPlayerStatusEffect,
  applyArmorReward,
  applyBlockReward,
} from "./status-player";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { getBattleRng, pickRandom, rollPercent } from "@/lib/rng";
import {
  PERCENT_DENOMINATOR,
  HALF_DIVISOR,
  REACTIVE_REWARD_CHANCES,
  WISH_CHOICE_COUNT,
  WISH_TRINKET_FORK_PERCENT,
} from "../game-constants";
import { dealEnemyScaledDamage } from "./scaled-damage";
import { gearFrozenDamageMultiplier } from "./scaled-damage";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { scaleByRoomMultiplier } from "./enemy-turn-traits";
import { appendUniqueMany } from "@/lib/utils";

function processEncounterTraitWish(state: BattleState): BattleState {
  if (!hasEnemyTrait(state, "jealous")) return state;
  return {
    ...recordEnemyAbilityActivation(state, "jealous"),
    enemyPhysicalDamageBonus: state.enemyPhysicalDamageBonus + scaleByRoomMultiplier(state, 1),
  };
}

export function buildWishOptions(
  state: BattleState,
  card: Pick<BattleCard, "id"> | undefined,
  companionOnly = false,
): BattleCard[] {
  const baseCount =
    WISH_CHOICE_COUNT +
    (hasEncounterBenefit(state, "wishful") && !state.flags.encounterWishUsed ? 1 : 0) +
    (rollBattleChance(state.talentEffects.wishExtraChoiceChance, state) ? 1 : 0);

  const candidates = getOfferableCardPool().filter(
    (candidate) =>
      candidate.id !== card?.id &&
      (!companionOnly || candidate.effects.some((effect) => effect.kind === "summon-companion")),
  );
  const fullDeck = [...state.deck, ...state.hand, ...state.pendingHandCards, ...state.discard, ...state.exhausted];
  const undiscovered = state.talentEffects.wishUndiscoveredCards
    ? candidates.filter((candidate) => !state.discoveredCardIds.includes(candidate.id))
    : [];
  const guaranteed =
    undiscovered.length > 0 ? selectRewardCards(fullDeck, undiscovered, 1, [], getBattleRng(state)) : [];
  const selected = [
    ...guaranteed,
    // Selection cannot offer more cards than the eligible pool.
    ...selectRewardCards(
      fullDeck,
      candidates,
      Math.min(baseCount, candidates.length) - guaranteed.length,
      guaranteed,
      getBattleRng(state),
    ),
  ];

  if (state.talentEffects.wishCardsUpgraded) {
    return selected.map((c) => upgradeWishCard(c));
  }
  return selected;
}

function applyWishGoldTriggers(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  const gearGold =
    state.gearEffects.goldOnWish > 0 && rollBattleChance(REACTIVE_REWARD_CHANCES.wishfulAffix, state)
      ? state.gearEffects.goldOnWish
      : 0;
  const talentGold =
    nextState.talentEffects.goldOnWish > 0 &&
    (nextState.talentEffects.goldOnWishChance <= 0 ||
      rollBattleChance(nextState.talentEffects.goldOnWishChance, nextState))
      ? nextState.talentEffects.goldOnWish
      : 0;
  const goldAmount = talentGold + gearGold;
  if (goldAmount > 0) {
    nextState = addGoldWithCombatText(nextState, goldAmount, combatTexts);
  }
  if (nextState.trinketEffects.wishingWellGoldOnWish > 0) {
    nextState = addGoldWithCombatText(nextState, nextState.trinketEffects.wishingWellGoldOnWish, combatTexts);
  }
  return nextState;
}

function applyWishHealthAndStatusTriggers(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  eligibility: BattleState,
): BattleState {
  let nextState = state;
  const healthGain =
    nextState.talentEffects.healthOnWish +
    (eligibility.playerHealth < eligibility.playerMaxHealth / HALF_DIVISOR ? nextState.gearEffects.healthOnWish : 0);
  if (healthGain > 0) {
    nextState = applyHealingWithCombatText(nextState, healthGain, combatTexts);
  }
  if (nextState.talentEffects.removeHarmfulStatusOnWish) {
    nextState = removeHarmfulPlayerStatuses(nextState, 1, combatTexts);
  }
  if (nextState.gearEffects.blockOnWish > 0) {
    nextState = applyBlockReward(nextState, nextState.gearEffects.blockOnWish, combatTexts);
  }
  return nextState;
}

function applyWishDrawTriggers(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const talentDraw = rollBattleChance(state.talentEffects.wishDrawChance, state) ? 1 : 0;
  const drawCount = talentDraw + state.gearEffects.drawOnWish;
  if (drawCount <= 0) return state;
  return applyDrawResult(state, drawFromState(state, drawCount), combatTexts);
}

export function applyWishEffect(
  state: BattleState,
  card: Pick<BattleCard, "id"> | undefined,
  amount: number,
  combatTexts: CombatTextEvent[],
  reactions: ReactionBoundary = { kind: "enclosing-action" },
  companionOnly = false,
) {
  const wishCount = Math.max(0, Math.round(amount));
  if (wishCount <= 0) return state;

  const nextWishOptions: BattleCard[][] = [];
  for (let index = 0; index < wishCount; index += 1) {
    nextWishOptions.push(buildWishOptions(state, card, companionOnly));
    if (hasEncounterBenefit(state, "wishful")) state = { ...state, flags: { ...state.flags, encounterWishUsed: true } };
  }
  const queuedOptions = nextWishOptions.filter((options) => options.length > 0);
  const nextState: BattleState =
    state.wishOptions || queuedOptions.length === 0
      ? { ...state, wishQueue: [...state.wishQueue, ...queuedOptions] }
      : {
          ...state,
          wishOptions: queuedOptions[0] ?? [],
          wishQueue: [...state.wishQueue, ...queuedOptions.slice(1)],
        };

  return resolveBattleSequence(
    nextState,
    Array.from({ length: wishCount }),
    combatTexts,
    (current) => {
      const eligibility = current;
      const settle = (next: BattleState) =>
        reactions.kind === "each-step" ? reactions.settle(next, combatTexts) : next;
      let next = settle(applyWishGoldTriggers(processEncounterTraitWish(current), combatTexts));
      if (getBattleOutcome(next) === "defeat") return next;
      next = settle(applyWishHealthAndStatusTriggers(next, combatTexts, eligibility));
      if (getBattleOutcome(next) === "defeat") return next;
      next = settle(applyWishDrawTriggers(next, combatTexts));
      if (getBattleOutcome(next) === "defeat") return next;
      if (eligibility.hand.length === 0 && next.gearEffects.nextCardDiscountOnEmptyHandWish > 0) {
        next = {
          ...next,
          flags: {
            ...next.flags,
            nextCardCostReduction: next.flags.nextCardCostReduction + next.gearEffects.nextCardDiscountOnEmptyHandWish,
          },
        };
      }
      next = settle(applyWishBurnTrigger(next, combatTexts, eligibility));
      if (getBattleOutcome(next) === "defeat") return next;
      if (next.gearEffects.freezeOnWish > 0) {
        next = resolveFollowUpHit(
          next,
          { source: "player-follow-up", damageType: "freeze", amount: next.gearEffects.freezeOnWish },
          combatTexts,
        );
      }
      next = settle(next);
      if (getBattleOutcome(next) === "defeat") return next;
      next = applyWishManaTrigger(next, combatTexts, eligibility);
      next = applyWishTrinketTrigger(next, combatTexts);
      return applyWishDesperateTrigger(next, combatTexts, eligibility);
    },
    reactions,
  );
}

/**
 * Empty draw piles are a player-facing emergency, not a new card source.
 * Reuse the normal Wish pipeline so existing rewards and random offer rules
 * apply consistently; an absent source leaves every real card eligible.
 */
export function applyEmergencyWish(state: BattleState, combatTexts: CombatTextEvent[] = []) {
  return applyWishEffect(state, undefined, 1, combatTexts, { kind: "enclosing-action" });
}

export function applyEmergencyWishForEmptyDraw(state: BattleState, amount: number, combatTexts: CombatTextEvent[]) {
  return amount > 0 &&
    state.turnPhase === "player" &&
    getBattleOutcome(state) === null &&
    !state.wishOptions &&
    state.hand.length === 0 &&
    state.pendingHandCards.length === 0 &&
    state.deck.length === 0 &&
    state.discard.length === 0
    ? applyEmergencyWish(state, combatTexts)
    : state;
}

function applyWishBurnTrigger(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  eligibility: BattleState,
): BattleState {
  state = resolveFollowUpHit(
    state,
    { source: "talent-fixed", damageType: "burn", amount: state.talentEffects.burnOnWish },
    combatTexts,
  );
  const burnAmount = state.gearEffects.burnOnWish;
  if (burnAmount <= 0 || state.enemyHealth <= 0 || eligibility.enemyStatuses.burn <= 0) return state;
  const enemyWasAlive = state.enemyHealth > 0;
  const multiplier = getEnemyDamageMultiplier(state, "burn") * gearFrozenDamageMultiplier(state);
  return dealEnemyScaledDamage(state, burnAmount, "burn", combatTexts, {
    multiplier,
    riders: (damagedState, damage, texts) =>
      applyHitEpilogue(
        applyDamageStatuses(
          damagedState,
          { kind: "damage", damageType: "burn", amount: burnAmount },
          damage,
          texts,
          state.enemyHealth,
        ),
        state.enemyHealth,
        enemyWasAlive,
        texts,
        undefined,
        state.playerStatuses.forge >= 5,
      ),
  });
}

function applyWishTrinketTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (!state.talentEffects.wishTrinketChoice || !rollBattleChance(REACTIVE_REWARD_CHANCES.wishfulTrinket, state))
    return state;
  const isForge = rollPercent(WISH_TRINKET_FORK_PERCENT, getBattleRng(state));
  const status = isForge ? ("forge" as const) : ("armor" as const);
  return status === "armor"
    ? applyArmorReward(state, 1, combatTexts)
    : applyPlayerStatusEffect(state, { kind: "player-status", status, amount: 1 }, combatTexts);
}

function applyWishDesperateTrigger(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  eligibility: BattleState,
): BattleState {
  const thresholdPct = state.talentEffects.wishBlockBelowHealthPct;
  const blockAmount = state.talentEffects.wishBlockAmount;
  if (thresholdPct <= 0 || blockAmount <= 0) return state;
  const thresholdHp = (eligibility.playerMaxHealth * thresholdPct) / PERCENT_DENOMINATOR;
  if (eligibility.playerHealth < thresholdHp) {
    return applyPlayerStatusEffect(
      state,
      { kind: "player-status", status: "block" as const, amount: blockAmount },
      combatTexts,
    );
  }
  return state;
}

function applyWishManaTrigger(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  eligibility: BattleState,
): BattleState {
  const manaGain = eligibility.mana === 0 ? state.gearEffects.manaOnWish : 0;
  if (manaGain <= 0) return state;
  return gainManaWithCombatText(state, manaGain, combatTexts, { skipFightPacing: true });
}

export function chooseWishCard(state: BattleState, cardId: string) {
  const [nextWishOptions = null, ...wishQueue] = state.wishQueue;

  const chosenCard = state.wishOptions?.find((card) => card.id === cardId);
  if (!chosenCard) {
    return state;
  }

  const declinedCards = (state.wishOptions ?? []).filter((card) => card.id !== chosenCard.id);
  let nextState = addCardToHandOrQueue({ ...state, wishOptions: nextWishOptions, wishQueue }, chosenCard);
  const acquiredIds = [chosenCard.id];
  if (declinedCards.length > 0 && rollBattleChance(nextState.talentEffects.declinedWishCardChance, nextState)) {
    const bonusCard = pickRandom(declinedCards, getBattleRng(nextState));
    if (bonusCard) {
      nextState = addCardToHandOrQueue(nextState, bonusCard);
      acquiredIds.push(bonusCard.id);
    }
  }
  return { ...nextState, discoveredCardIds: appendUniqueMany(nextState.discoveredCardIds, acquiredIds) };
}
