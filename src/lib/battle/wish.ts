import { resolveBattleSequence, type ReactionBoundary } from "./battle-sequence";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { hasEncounterBenefit, hasEnemyTrait } from "./types";
import { selectRewardCards } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import type { BattleCard } from "@/lib/game-data";
import { addCardToHandOrQueue, applyDrawResult, drawFromState } from "./draw";
import { type BattleState, type CombatTextEvent } from "./types";
import {
  addGoldWithCombatText,
  applyHealingWithCombatText,
  applyHitEpilogue,
  gainManaWithCombatText,
  mergeCombatText,
} from "./combat-text";
import {
  removeHarmfulPlayerStatuses,
  applyPlayerStatusEffect,
  applyArmorReward,
  applyBlockReward,
} from "./status-player";
import { getEnemyDamageMultiplier, rollTalentChance } from "./status-helpers";
import { getBattleRng, pickRandom, rollPercent } from "@/lib/rng";
import { getEditableCorruptionTargets, updateCardNumericValue } from "@/lib/corruption";
import { getCorruptionTargetEffect } from "@/lib/corruption/numeric";
import {
  PERCENT_DENOMINATOR,
  HALF_DIVISOR,
  REACTIVE_REWARD_CHANCES,
  WISH_CHOICE_COUNT,
  WISH_GEMS_GOLD_PERCENT,
  WISH_TRINKET_FORK_PERCENT,
} from "../game-constants";
import { shouldConvertGemsWishToGold } from "@/lib/content-systems/battle-content";
import { dealEnemyScaledDamage } from "./scaled-damage";
import { gearFrozenDamageMultiplier } from "./gear-effects";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { scaleByRoomMultiplier } from "./enemy-turn-traits";

function processEncounterTraitWish(state: BattleState): BattleState {
  if (!hasEnemyTrait(state, "jealous")) return state;
  return {
    ...recordEnemyAbilityActivation(state, "jealous"),
    enemyPhysicalDamageBonus: state.enemyPhysicalDamageBonus + scaleByRoomMultiplier(state, 1),
  };
}

function upgradeWishCard(card: BattleCard): BattleCard {
  const targets = getEditableCorruptionTargets(card).sort(
    (a, b) => b.lineIndex - a.lineIndex || b.matchIndex - a.matchIndex,
  );
  return targets.reduce((next, target) => {
    const effect = getCorruptionTargetEffect(next, target);
    // An upgrade must not raise a cost, including a shared Deal/Receive amount.
    if (
      !effect ||
      ["lose-health", "self-damage", "lose-mana", "lose-max-mana"].includes(effect.kind) ||
      next.descriptionLines[target.lineIndex]?.startsWith("Deal and Receive ")
    )
      return next;
    return updateCardNumericValue(next, target, target.value + 1);
  }, card);
}

export function buildWishOptions(
  state: BattleState,
  card: Pick<BattleCard, "id"> | undefined,
  companionOnly = false,
): BattleCard[] {
  const baseCount =
    WISH_CHOICE_COUNT +
    state.talentEffects.wishExtraChoices +
    (state.flags.nextWishExtraChoice ? 1 : 0) +
    (hasEncounterBenefit(state, "wishful") && !state.flags.encounterWishUsed ? 1 : 0) +
    (rollTalentChance(state.talentEffects.wishExtraChoiceChance, state) ? 1 : 0);

  const candidates = getOfferableCardPool().filter(
    (candidate) =>
      candidate.id !== card?.id &&
      (!companionOnly || candidate.effects.some((effect) => effect.kind === "summon-companion")),
  );
  const fullDeck = [...state.deck, ...state.hand, ...state.discard, ...state.exhausted];
  const undiscovered = state.talentEffects.wishUndiscoveredCards
    ? candidates.filter((candidate) => !state.discoveredCardIds.includes(candidate.id))
    : [];
  const guaranteed =
    undiscovered.length > 0 ? selectRewardCards(fullDeck, undiscovered, 1, [], getBattleRng(state)) : [];
  const selected = [
    ...guaranteed,
    ...selectRewardCards(fullDeck, candidates, baseCount - guaranteed.length, guaranteed, getBattleRng(state)),
  ];

  if (state.talentEffects.wishCardsUpgraded) {
    return selected.map((c) => upgradeWishCard(c));
  }
  return selected;
}

function applyWishGoldTriggers(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  const gearGold =
    state.gearEffects.goldOnWish > 0 && rollTalentChance(REACTIVE_REWARD_CHANCES.wishfulAffix, state)
      ? state.gearEffects.goldOnWish
      : 0;
  const talentGold =
    nextState.talentEffects.goldOnWish > 0 &&
    (nextState.talentEffects.goldOnWishChance <= 0 ||
      rollTalentChance(nextState.talentEffects.goldOnWishChance, nextState))
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

function applyWishGemsGoldTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const amount = state.talentEffects.wishGemsGold;
  if (amount <= 0) return state;
  if (rollPercent(WISH_GEMS_GOLD_PERCENT, getBattleRng(state))) {
    return addGoldWithCombatText(state, amount, combatTexts);
  }
  if (shouldConvertGemsWishToGold(state.contentSystemType)) {
    return addGoldWithCombatText(state, amount, combatTexts);
  }
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gems", amount });
  return {
    ...state,
    pendingMaterials: { ...state.pendingMaterials, gems: state.pendingMaterials.gems + amount },
  };
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

function applyWishDrawTriggers(state: BattleState): BattleState {
  const talentDraw =
    state.talentEffects.wishDrawsCard || rollTalentChance(state.talentEffects.wishDrawChance, state) ? 1 : 0;
  const drawCount = talentDraw + state.gearEffects.drawOnWish;
  if (drawCount <= 0) return state;
  return applyDrawResult(state, drawFromState(state, drawCount));
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
    if (state.flags.nextWishExtraChoice) state = { ...state, flags: { ...state.flags, nextWishExtraChoice: false } };
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
      let next = applyWishGoldTriggers(processEncounterTraitWish(current), combatTexts);
      next = applyWishGemsGoldTrigger(next, combatTexts);
      next = applyWishHealthAndStatusTriggers(next, combatTexts, eligibility);
      next = applyWishDrawTriggers(next);
      if (eligibility.hand.length === 0 && next.gearEffects.nextCardDiscountOnEmptyHandWish > 0) {
        next = {
          ...next,
          flags: {
            ...next.flags,
            nextCardCostReduction: next.flags.nextCardCostReduction + next.gearEffects.nextCardDiscountOnEmptyHandWish,
          },
        };
      }
      next = applyWishBurnTrigger(next, combatTexts, eligibility);
      if (next.gearEffects.freezeOnWish > 0) {
        next = resolveFollowUpHit(
          next,
          { source: "player-follow-up", damageType: "freeze", amount: next.gearEffects.freezeOnWish },
          combatTexts,
        );
      }
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
    riders: (damagedState) => applyHitEpilogue(damagedState, state.enemyHealth, enemyWasAlive, combatTexts),
  });
}

function applyWishTrinketTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (!state.talentEffects.wishTrinketChoice || !rollTalentChance(REACTIVE_REWARD_CHANCES.wishfulTrinket, state))
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
  if (state.talentEffects.manaNextTurnOnWish > 0) {
    state = {
      ...state,
      flags: {
        ...state.flags,
        pendingWishMana: state.flags.pendingWishMana + state.talentEffects.manaNextTurnOnWish,
      },
    };
  }
  const manaGain = state.talentEffects.manaOnWish + (eligibility.mana === 0 ? state.gearEffects.manaOnWish : 0);
  if (manaGain <= 0) return state;
  return gainManaWithCombatText(state, manaGain, combatTexts, { skipFightPacing: true });
}

export function chooseWishCard(state: BattleState, cardId: string, combatTexts: CombatTextEvent[] = []) {
  const [nextWishOptions = null, ...wishQueue] = state.wishQueue;

  const chosenCard = state.wishOptions?.find((card) => card.id === cardId);
  if (!chosenCard) {
    return state;
  }

  const declined = Math.max(0, (state.wishOptions?.length ?? 0) - 1);
  const declinedCards = (state.wishOptions ?? []).filter((card) => card.id !== chosenCard.id);
  const blockAmount = declined * state.talentEffects.blockPerDeclinedWishCard;
  const rewarded =
    blockAmount > 0
      ? applyPlayerStatusEffect(state, { kind: "player-status", status: "block", amount: blockAmount }, combatTexts)
      : state;
  let nextState = addCardToHandOrQueue({ ...rewarded, wishOptions: nextWishOptions, wishQueue }, chosenCard);
  if (declinedCards.length > 0 && rollTalentChance(nextState.talentEffects.declinedWishCardChance, nextState)) {
    const bonusCard = pickRandom(declinedCards, getBattleRng(nextState));
    if (bonusCard) nextState = addCardToHandOrQueue(nextState, bonusCard);
  }
  return nextState;
}
