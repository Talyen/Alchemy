import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { MAX_HAND_SIZE, UNIQUE_GEAR_COMBAT } from "../game-constants";
import { damageOnlyEffects } from "./damage-effect-selection";
import { applyCardEffects } from "./effect-handlers";
import { cardHasDamageType, cardHasKeyword, isNatureCard } from "./card-classification";
import { processCompanionTurnStart } from "./companion";
import { type BattleState, type CombatTextEvent, isPlayerDefeated, withPreservedFlags } from "./types";

export function repeatUniqueCardDamage(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  multiplier = 1,
): BattleState {
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;
  const repeated = withPreservedFlags({ ...state, flags: { ...state.flags, uniqueRepeatActive: true } }, (current) =>
    applyCardEffects(current, { ...card, effects: damageOnlyEffects(card.effects) }, combatTexts, {
      cardHealing: true,
      manaAtStart: current.mana,
      enemyFreezeSkipTurnsAtStart: current.enemyCC.freezeSkipTurns,
      damageMultiplier: multiplier,
    }),
  );
  return { ...repeated, flags: { ...repeated.flags, uniqueRepeatActive: state.flags.uniqueRepeatActive } };
}

export function prepareUniqueCardPlay(state: BattleState, card: BattleCard, manaCost: number) {
  const gear = state.gearEffects;
  const unique = state.uniqueGear;
  const physical = cardHasDamageType(card, "physical");
  const archery = cardHasKeyword(card, "archery");
  const nature = isNatureCard(card);
  const everkeen = gear.forgeReadiesPhysicalRepeat > 0 && unique.everkeenReady && physical;
  const finalSpark =
    gear.lastManaElementalRepeat > 0 &&
    !unique.finalSparkUsed &&
    state.mana > 0 &&
    manaCost >= state.mana &&
    (cardHasKeyword(card, "burn") || cardHasKeyword(card, "freeze"));
  const hunt = gear.firstArcheryCompanionAttack > 0 && !unique.huntsmasterUsed && archery;
  const harvest = gear.returnFirstPhysicalCard > 0 && !unique.redHarvestUsed && physical;
  const critical = gear.dodgeReadiesNatureCrit > 0 && unique.wildheartReady && nature;
  const damageEffects: Array<Extract<BattleCardEffect, { kind: "damage" }>> = [];
  return {
    damageEffects,
    repeatCount: Number(everkeen) + Number(finalSpark),
    hunt,
    harvest,
    critical,
    state: {
      ...state,
      uniqueGear: {
        ...unique,
        everkeenReady: everkeen ? false : unique.everkeenReady,
        wildheartReady: critical ? false : unique.wildheartReady,
        knightsAnswerReady: physical ? false : unique.knightsAnswerReady,
        returningFlightUid: card.uid === unique.returningFlightUid ? null : unique.returningFlightUid,
        redHarvestUsed: unique.redHarvestUsed || harvest,
        huntsmasterUsed: unique.huntsmasterUsed || hunt,
        finalSparkUsed: unique.finalSparkUsed || finalSpark,
        wrenflightActive: unique.wrenflightActive || (gear.archeryDodgeAndDraw > 0 && archery),
        freeBurnUsed: unique.freeBurnUsed || (gear.firstElementalCardsFree > 0 && cardHasKeyword(card, "burn")),
        freeFreezeUsed: unique.freeFreezeUsed || (gear.firstElementalCardsFree > 0 && cardHasKeyword(card, "freeze")),
        freeHolyUsed: unique.freeHolyUsed || (gear.firstElementalCardsFree > 0 && cardHasKeyword(card, "holy")),
        lastArcheryUid: gear.recoverLastArcheryCard > 0 && archery ? (card.uid ?? null) : unique.lastArcheryUid,
      },
    },
  };
}

export function finishUniqueCardDamage(
  state: BattleState,
  card: BattleCard,
  prepared: ReturnType<typeof prepareUniqueCardPlay>,
  combatTexts: CombatTextEvent[],
): BattleState {
  const damageCard = { ...card, effects: prepared.damageEffects };
  let next = state;
  if (state.gearEffects.archeryEchoNextTurn > 0 && cardHasKeyword(card, "archery") && damageCard.effects.length > 0) {
    next = {
      ...next,
      uniqueGear: { ...next.uniqueGear, archeryEchoes: [...next.uniqueGear.archeryEchoes, damageCard] },
    };
  }
  for (let i = 0; i < prepared.repeatCount; i++) next = repeatUniqueCardDamage(next, damageCard, combatTexts);
  return prepared.hunt ? processCompanionTurnStart(next, combatTexts, { damageOnly: true }) : next;
}

export function returnHarvestCard(state: BattleState, card: BattleCard): BattleState {
  if (card.consume || state.hand.length >= MAX_HAND_SIZE || isPlayerDefeated(state)) return state;
  const index = state.discard.findLastIndex((candidate) => candidate === card);
  if (index < 0) return state;
  const returned = { ...card, uid: state.nextCardUid };
  return {
    ...state,
    hand: [...state.hand, returned],
    discard: state.discard.filter((_, i) => i !== index),
    nextCardUid: state.nextCardUid + 1,
    uniqueGear: { ...state.uniqueGear, redHarvestUid: returned.uid },
  };
}

export function processArcheryEchoes(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const echoes = state.uniqueGear.archeryEchoes;
  let next: BattleState = { ...state, uniqueGear: { ...state.uniqueGear, archeryEchoes: [] } };
  if (state.gearEffects.archeryEchoNextTurn <= 0) return next;
  for (const card of echoes) {
    next = repeatUniqueCardDamage(next, card, combatTexts, UNIQUE_GEAR_COMBAT.echoDamageMultiplier);
  }
  return next;
}
