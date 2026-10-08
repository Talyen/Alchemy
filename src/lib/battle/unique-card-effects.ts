import { resolveSecondaryAction } from "./action-context";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { UNIQUE_GEAR_COMBAT } from "../game-constants";
import { damageOnlyEffects, isAttackCard } from "./card-classification";
import { applyCardEffects } from "./effect-handlers";
import { cardHasDamageType, cardHasKeyword, isNatureCard } from "./card-classification";
import type { BattleState, CombatTextEvent } from "./types";
import { isPlayerDefeated } from "./health-state";

export function repeatUniqueCardDamage(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  multiplier = 1,
): BattleState {
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;
  return resolveSecondaryAction(state, "repeat", (current) =>
    applyCardEffects(current, { ...card, effects: damageOnlyEffects(card.effects) }, combatTexts, {
      origin: "triggered-card",
      manaAtStart: current.mana,
      enemyFreezeSkipTurnsAtStart: current.enemyCC.freezeSkipTurns,
      damageMultiplier: multiplier,
    }),
  );
}

export function prepareUniqueCardPlay(state: BattleState, card: BattleCard, manaCost: number) {
  const gear = state.gearEffects;
  const unique = state.uniqueGear;
  const archery = (gear.archeryDodgeAndDraw > 0 || gear.recoverLastArcheryCard > 0) && cardHasKeyword(card, "archery");
  const everkeen = gear.forgeReadiesPhysicalRepeat > 0 && unique.everkeenReady && cardHasDamageType(card, "physical");
  const finalSpark =
    gear.lastManaElementalRepeat > 0 &&
    !unique.finalSparkUsed &&
    state.mana > 0 &&
    manaCost >= state.mana &&
    isAttackCard(card) &&
    (cardHasKeyword(card, "burn") || cardHasKeyword(card, "freeze"));
  const critical = gear.dodgeReadiesNatureCrit > 0 && unique.wildheartReady && isNatureCard(card);
  const wrenflightActive = unique.wrenflightActive || (gear.archeryDodgeAndDraw > 0 && archery);
  const lastArcheryUid = gear.recoverLastArcheryCard > 0 && archery ? (card.uid ?? null) : unique.lastArcheryUid;
  const uniqueChanged =
    everkeen ||
    critical ||
    finalSpark ||
    wrenflightActive !== unique.wrenflightActive ||
    lastArcheryUid !== unique.lastArcheryUid;
  const damageEffects: Array<Extract<BattleCardEffect, { kind: "damage" }>> = [];
  return {
    damageEffects,
    repeatCount: Number(everkeen) + Number(finalSpark),
    critical,
    state: uniqueChanged
      ? {
          ...state,
          uniqueGear: {
            ...unique,
            everkeenReady: everkeen ? false : unique.everkeenReady,
            wildheartReady: critical ? false : unique.wildheartReady,
            finalSparkUsed: unique.finalSparkUsed || finalSpark,
            wrenflightActive,
            lastArcheryUid,
          },
        }
      : state,
  };
}

export function finishUniqueCardDamage(
  state: BattleState,
  card: BattleCard,
  prepared: ReturnType<typeof prepareUniqueCardPlay>,
  combatTexts: CombatTextEvent[],
): BattleState {
  const echo =
    state.gearEffects.archeryEchoNextTurn > 0 && prepared.damageEffects.length > 0 && cardHasKeyword(card, "archery");
  if (!echo && prepared.repeatCount === 0) return state;
  const damageCard = { ...card, effects: prepared.damageEffects };
  let next = state;
  if (echo) {
    next = {
      ...next,
      uniqueGear: { ...next.uniqueGear, archeryEchoes: [...next.uniqueGear.archeryEchoes, damageCard] },
    };
  }
  for (let i = 0; i < prepared.repeatCount; i++) next = repeatUniqueCardDamage(next, damageCard, combatTexts);
  return next;
}

export function processArcheryEchoes(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const echoes = state.uniqueGear.archeryEchoes;
  if (echoes.length === 0) return state;
  let next: BattleState = { ...state, uniqueGear: { ...state.uniqueGear, archeryEchoes: [] } };
  if (state.gearEffects.archeryEchoNextTurn <= 0) return next;
  for (const card of echoes) {
    next = repeatUniqueCardDamage(next, card, combatTexts, UNIQUE_GEAR_COMBAT.echoDamageMultiplier);
  }
  return next;
}
