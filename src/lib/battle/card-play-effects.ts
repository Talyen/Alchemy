import { readCombatFlag } from "./action-context";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { prepareTalentCardPlay } from "./talent-card-play";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { drawKeywordCard } from "./draw";
import { applyCardEffects } from "./effect-handlers";
import { addPlayerStatusWithCombatText, applyHealingWithCombatText, gainManaWithCombatText } from "./player-rewards";
import { isPotionCard, type BattleCard } from "@/lib/game-data";
import { type BattleState, type CombatTextEvent, isPlayerDefeated } from "./types";
import { processCompanionTurnStart } from "./companion";
import { applyArmorReward, applyBlockReward } from "./status-player";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { rollTalentChance } from "./status-helpers";
import { cardHasKeyword, isNatureCard } from "./card-classification";
import { WISH_TRINKET_FORK_PERCENT } from "../game-constants";

export function applyMortarAndPestlePotionUse(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]) {
  if (isPlayerDefeated(state) || !isPotionCard(card) || state.trinketEffects.mortarPestlePoisonOnPotionUse <= 0)
    return state;
  return resolvePendingBattleReactions(
    resolveFollowUpHit(
      state,
      { source: "player-follow-up", damageType: "poison", amount: state.trinketEffects.mortarPestlePoisonOnPotionUse },
      combatTexts,
    ),
    combatTexts,
  );
}

export interface CardEffectChainOptions {
  playedCard?: boolean;
  guaranteedCrit?: boolean;
  damageEffects?: NonNullable<CardEffectResolutionContext["damageEffects"]>;
  manaAtStart?: number;
  enemyFreezeSkipTurnsAtStart?: number;
  skipTalentRewards?: boolean;
}

// Shared core for playing a card's effects: talent pre-triggers, pending
// reactions, the effect dispatch itself, potion use, and talent rewards.
// Normal plays and dodge-drawn plays share these effect stages but have
// different payment and repeat rules.
export function resolveCardEffectChain(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  options: CardEffectChainOptions = {},
): {
  state: BattleState;
  attackAttempted: boolean;
  attackBonuses: NonNullable<CardEffectResolutionContext["attackBonuses"]>;
} {
  const talentPlay = prepareTalentCardPlay(state, card, combatTexts, {
    countsAsPlayedCard: options.playedCard === true,
  });
  const reacted = resolvePendingBattleReactions(talentPlay.state, combatTexts);
  const damageEffects = options.damageEffects ?? [];
  let nextState = applyCardEffects(reacted, card, combatTexts, {
    attackBonuses: talentPlay.attackBonuses,
    origin: options.playedCard ? "played-card" : "triggered-card",
    damageEffects,
    manaAtStart: options.manaAtStart ?? reacted.mana,
    enemyFreezeSkipTurnsAtStart: options.enemyFreezeSkipTurnsAtStart ?? reacted.enemyCC.freezeSkipTurns,
    ...(options.guaranteedCrit === undefined ? {} : { guaranteedCrit: options.guaranteedCrit }),
  });
  nextState = applyMortarAndPestlePotionUse(nextState, card, combatTexts);
  if (!options.skipTalentRewards) {
    nextState = applyCardPlayTalentRewards(nextState, card, combatTexts, state.playerStatuses.thorns === 0);
  }
  return { state: nextState, attackAttempted: damageEffects.length > 0, attackBonuses: talentPlay.attackBonuses };
}

export function shouldElementalTalentRepeat(state: BattleState, card: BattleCard, alreadyRepeating = false): boolean {
  if (alreadyRepeating) return false;

  const chance =
    (cardHasKeyword(card, "burn") ? state.talentEffects.burnCardPlayTwiceChance : 0) +
    (cardHasKeyword(card, "freeze") ? state.talentEffects.freezeCardPlayTwiceChance : 0) +
    (cardHasKeyword(card, "nature") ? state.talentEffects.natureCardPlayTwiceChance : 0) +
    (cardHasKeyword(card, "poison") ? state.talentEffects.poisonCardPlayTwiceChance : 0) +
    (cardHasKeyword(card, "stun") ? state.talentEffects.stunCardPlayTwiceChance : 0) +
    (cardHasKeyword(card, "wish") ? state.talentEffects.wishCardPlayTwiceChance : 0);

  return rollTalentChance(Math.min(100, chance), state);
}

interface PaidCardEffectsOptions {
  playTwice: boolean;
  guaranteedCrit: boolean;
  damageEffects: NonNullable<CardEffectResolutionContext["damageEffects"]>;
  manaAtStart: number;
  enemyFreezeSkipTurnsAtStart: number;
  hadNoThornsOnPlay: boolean;
}

export function resolvePaidCardEffects(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  {
    playTwice,
    guaranteedCrit,
    damageEffects,
    manaAtStart,
    enemyFreezeSkipTurnsAtStart,
    hadNoThornsOnPlay,
  }: PaidCardEffectsOptions,
): {
  state: BattleState;
  attackAttempted: boolean;
  repeatAttackAttempted: boolean;
} {
  const chained = resolveCardEffectChain(state, card, combatTexts, {
    playedCard: true,
    guaranteedCrit,
    damageEffects,
    manaAtStart,
    enemyFreezeSkipTurnsAtStart,
    // Play-twice resolves both damage copies before talent rewards so
    // companion/nature triggers fire once after the full play.
    skipTalentRewards: playTwice,
  });
  let nextState = chained.state;

  const repeatedDamageEffects: NonNullable<CardEffectResolutionContext["damageEffects"]> = [];
  if (playTwice) {
    nextState = applyCardEffects(nextState, card, combatTexts, {
      attackBonuses: chained.attackBonuses,
      origin: "played-card",
      damageEffects: repeatedDamageEffects,
      guaranteedCrit,
      manaAtStart: nextState.mana,
      enemyFreezeSkipTurnsAtStart: nextState.enemyCC.freezeSkipTurns,
    });
    nextState = applyMortarAndPestlePotionUse(nextState, card, combatTexts);
    nextState = applyCardPlayTalentRewards(nextState, card, combatTexts, hadNoThornsOnPlay);
  }

  nextState = applyTwinCasting(nextState, card);

  return {
    state: nextState,
    attackAttempted: damageEffects.length > 0,
    repeatAttackAttempted: repeatedDamageEffects.length > 0,
  };
}

function applyTwinCasting(state: BattleState, card: BattleCard): BattleState {
  if (isPlayerDefeated(state) || state.gearEffects.elementalTwinCasting <= 0) return state;

  const hasBurn = cardHasKeyword(card, "burn");
  const hasFreeze = cardHasKeyword(card, "freeze");

  let targetType: "burn" | "freeze" | null = null;
  if (hasBurn && hasFreeze) {
    targetType = rollPercent(WISH_TRINKET_FORK_PERCENT, getBattleRng(state)) ? "freeze" : "burn";
  } else if (hasBurn) {
    targetType = "freeze";
  } else if (hasFreeze) {
    targetType = "burn";
  }
  if (!targetType) return state;
  return drawKeywordCard(state, targetType, { refillFromDiscard: false });
}

export function applyResonantChimeTrinket(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const { resonantChimeCardsRequired, resonantChimeMana } = state.trinketEffects;
  if (
    resonantChimeCardsRequired > 0 &&
    resonantChimeMana > 0 &&
    !readCombatFlag(state, "resonantChimeUsedThisTurn") &&
    state.cardsPlayedThisTurn >= resonantChimeCardsRequired
  ) {
    const afterMana = gainManaWithCombatText(state, resonantChimeMana, combatTexts);
    if (afterMana.mana <= state.mana) return state;
    return { ...afterMana, flags: { ...state.flags, resonantChimeUsedThisTurn: true } };
  }
  return state;
}

export function applyCardPlayTalentRewards(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  hadNoThornsOnPlay = state.playerStatuses.thorns === 0,
): BattleState {
  if (isPlayerDefeated(state)) return state;
  let nextState = applyNatureCardPlayTalents(state, card, combatTexts, hadNoThornsOnPlay);
  if (nextState.talentEffects.companionActsOnCard && cardHasKeyword(card, "companion")) {
    nextState = processCompanionTurnStart(nextState, combatTexts);
  }
  return nextState;
}

function applyNatureCardPlayTalents(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  hadNoThornsOnPlay: boolean,
): BattleState {
  if (!isNatureCard(card)) return state;
  let nextState = state;
  if (hadNoThornsOnPlay && state.gearEffects.thornsOnNatureCardWithoutThorns > 0) {
    nextState = addPlayerStatusWithCombatText(
      nextState,
      "thorns",
      state.gearEffects.thornsOnNatureCardWithoutThorns,
      combatTexts,
    );
  }
  if (nextState.talentEffects.blockOnNatureCard > 0) {
    nextState = applyBlockReward(nextState, nextState.talentEffects.blockOnNatureCard, combatTexts);
  }
  if (nextState.talentEffects.healOnNatureCard > 0) {
    nextState = applyHealingWithCombatText(nextState, nextState.talentEffects.healOnNatureCard, combatTexts);
  }
  if (nextState.gearEffects.armorOnNatureCard > 0) {
    nextState = applyArmorReward(nextState, nextState.gearEffects.armorOnNatureCard, combatTexts);
  }
  return nextState;
}
