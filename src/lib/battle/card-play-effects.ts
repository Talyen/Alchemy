import { rollBattleChance } from "./chance-roll";
import { readCombatFlag, writeCombatFlag } from "./action-context";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { prepareTalentCardPlay } from "./talent-card-play";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { drawKeywordCard } from "./draw";
import { applyCardEffects } from "./effect-handlers";
import { addPlayerStatusWithCombatText, gainManaWithCombatText } from "./player-rewards";
import { isPotionCard, type BattleCard } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { getBattleOutcome, isPlayerDefeated } from "./battle-outcome";
import { processCompanionTurnStart } from "./companion";
import { applyArmorReward } from "./status-player";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { cardHasKeyword, isNatureCard } from "./card-classification";
import { WISH_TRINKET_FORK_PERCENT } from "../game-constants";

function applyMortarAndPestlePotionUse(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]) {
  if (isPlayerDefeated(state) || state.trinketEffects.mortarPestlePoisonOnPotionUse <= 0 || !isPotionCard(card))
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

interface CardEffectChainOptions {
  eligibility?: BattleState;
  playedCard?: boolean;
  guaranteedCrit?: boolean;
  damageEffects?: NonNullable<CardEffectResolutionContext["damageEffects"]>;
  manaAtStart?: number;
  playTwice?: boolean;
}

// Shared core for playing a card's effects: talent pre-triggers, pending
// reactions, the effect dispatch itself, potion use, and talent rewards.
// Payment, Unique Gear damage-only repeats, and card destination stay with callers.
export function resolveCardEffectChain(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  options: CardEffectChainOptions = {},
): {
  state: BattleState;
  attackAttempted: boolean;
  repeatAttackAttempted: boolean;
} {
  const hadNoThornsOnPlay = (options.eligibility ?? state).playerStatuses.thorns === 0;
  state = resolvePendingBattleReactions(state, combatTexts);
  if (isPlayerDefeated(state)) {
    return { state, attackAttempted: false, repeatAttackAttempted: false };
  }
  const talentPlay = prepareTalentCardPlay(state, card, combatTexts, {
    countsAsPlayedCard: options.playedCard === true,
    ...(options.eligibility ? { eligibility: options.eligibility } : {}),
  });
  const reacted = resolvePendingBattleReactions(talentPlay, combatTexts);
  const damageEffects = options.damageEffects ?? [];
  const repeatedDamageEffects: NonNullable<CardEffectResolutionContext["damageEffects"]> = [];
  let nextState = reacted;
  let attackAttempted = false;
  let repeatAttackAttempted = false;
  for (let copy = 0; copy < (options.playTwice ? 2 : 1); copy++) {
    // The first copy can be accepted during victory grace; repeats require a live fight.
    if (copy > 0 && getBattleOutcome(nextState) !== null) break;
    // Each copy starts an attack; an earlier copy may have spent the penalty.
    const concussion = nextState.flags.concussionReady;
    // Dodged packets mark the attempt cell without joining the resolved damage
    // that Unique repeats and Archery echoes replay.
    const attemptCell = { value: false };
    nextState = applyCardEffects(nextState, card, combatTexts, {
      origin: options.playedCard ? "played-card" : "triggered-card",
      damageEffects: copy === 0 ? damageEffects : repeatedDamageEffects,
      attackAttempted: attemptCell,
      ...(concussion ? { damageMultiplier: 0.75 } : {}),
      manaAtStart: copy === 0 ? (options.manaAtStart ?? reacted.mana) : nextState.mana,
      ...(options.guaranteedCrit === undefined ? {} : { guaranteedCrit: options.guaranteedCrit }),
    });
    const attempted = (copy === 0 ? damageEffects : repeatedDamageEffects).length > 0 || attemptCell.value;
    if (copy === 0) attackAttempted = attempted;
    else repeatAttackAttempted = attempted;
    if (concussion && attempted) nextState = { ...nextState, flags: { ...nextState.flags, concussionReady: false } };
    nextState = applyMortarAndPestlePotionUse(nextState, card, combatTexts);
  }
  // A full-card repeat repeats effects and Potion use, but rewards the play once.
  nextState = applyCardPlayTalentRewards(nextState, card, combatTexts, hadNoThornsOnPlay);
  nextState = applyTwinCasting(nextState, card, combatTexts);
  return {
    state: nextState,
    attackAttempted,
    repeatAttackAttempted,
  };
}

export function shouldElementalTalentRepeat(state: BattleState, card: BattleCard): boolean {
  const {
    burnCardPlayTwiceChance,
    freezeCardPlayTwiceChance,
    natureCardPlayTwiceChance,
    poisonCardPlayTwiceChance,
    stunCardPlayTwiceChance,
    wishCardPlayTwiceChance,
  } = state.talentEffects;

  let chance = 0;
  if (burnCardPlayTwiceChance > 0 && cardHasKeyword(card, "burn")) chance += burnCardPlayTwiceChance;
  if (freezeCardPlayTwiceChance > 0 && cardHasKeyword(card, "freeze")) chance += freezeCardPlayTwiceChance;
  if (natureCardPlayTwiceChance > 0 && cardHasKeyword(card, "nature")) chance += natureCardPlayTwiceChance;
  if (poisonCardPlayTwiceChance > 0 && cardHasKeyword(card, "poison")) chance += poisonCardPlayTwiceChance;
  if (stunCardPlayTwiceChance > 0 && cardHasKeyword(card, "stun")) chance += stunCardPlayTwiceChance;
  if (wishCardPlayTwiceChance > 0 && cardHasKeyword(card, "wish")) chance += wishCardPlayTwiceChance;

  return rollBattleChance(Math.min(100, chance), state);
}

function applyTwinCasting(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]): BattleState {
  if (getBattleOutcome(state) !== null || state.gearEffects.elementalTwinCasting <= 0) return state;

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
  return drawKeywordCard(state, targetType, { refillFromDiscard: false, combatTexts });
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
    return writeCombatFlag(afterMana, "resonantChimeUsedThisTurn", true);
  }
  return state;
}

function applyCardPlayTalentRewards(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  hadNoThornsOnPlay = state.playerStatuses.thorns === 0,
): BattleState {
  if (isPlayerDefeated(state)) return state;
  let nextState = applyNatureCardPlayGearRewards(state, card, combatTexts, hadNoThornsOnPlay);
  if (nextState.talentEffects.companionActsOnCard && cardHasKeyword(card, "companion")) {
    nextState = processCompanionTurnStart(nextState, combatTexts);
  }
  return nextState;
}

function applyNatureCardPlayGearRewards(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  hadNoThornsOnPlay: boolean,
): BattleState {
  if (state.gearEffects.thornsOnNatureCardWithoutThorns <= 0 && state.gearEffects.armorOnNatureCard <= 0) return state;
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
  if (nextState.gearEffects.armorOnNatureCard > 0 && !nextState.flags.ironrootArmorUsedThisTurn) {
    nextState = writeCombatFlag(nextState, "ironrootArmorUsedThisTurn", true);
    nextState = applyArmorReward(nextState, nextState.gearEffects.armorOnNatureCard, combatTexts);
  }
  return nextState;
}
