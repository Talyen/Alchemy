/**
 * Routes card effects to per-kind apply handlers (see registry.ts and game-data/effects/).
 */
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { isPotionCard } from "@/lib/game-data/cards/card-pools";
import type { BattleState, CombatTextEvent } from "../types";
import { getBattleRng } from "../status-helpers";
import { applyEffectByKind } from "./registry";
import type { CardEffectResolutionContext } from "./handler-types";

function applySingleEffect(
  state: BattleState,
  card: BattleCard,
  effect: BattleCardEffect,
  potionMult: number,
  combatTexts: CombatTextEvent[],
  context: CardEffectResolutionContext,
): BattleState {
  if (effect.kind === "chance") {
    const rng = getBattleRng(state);
    const branch = rng() < effect.probability ? effect.successEffects : effect.failureEffects;
    return branch.reduce(
      (s, nested) => applyCardEffects(s, { ...card, effects: [nested] }, combatTexts, context),
      state,
    );
  }

  if (effect.kind === "repeat-over-turns") {
    return {
      ...state,
      pendingTurnStartEffects: [
        ...state.pendingTurnStartEffects,
        { remainingTurns: effect.remainingTurns, effects: effect.effects },
      ],
    };
  }

  return applyEffectByKind(effect.kind, state, card, effect, potionMult, combatTexts, context);
}

export function applyCardEffects(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  context: CardEffectResolutionContext = {
    manaAtStart: state.mana,
    enemyFreezeSkipTurnsAtStart: state.enemyCC.freezeSkipTurns,
  },
): BattleState {
  const potionMult = isPotionCard(card) ? state.talentEffects.potionPotency : 1;
  return card.effects.reduce(
    (currentState, effect) => applySingleEffect(currentState, card, effect, potionMult, combatTexts, context),
    state,
  );
}
