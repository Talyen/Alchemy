/**
 * Routes card effects to per-kind apply handlers (see registry.ts and game-data/effects/).
 */
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "../types";
import { POTION_CARD_ID_SUFFIX } from "../../game-constants";
import { getBattleRng } from "../status-helpers";
import { applyEffectByKind } from "./registry";

function applySingleEffect(
  state: BattleState,
  card: BattleCard,
  effect: BattleCardEffect,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (effect.kind === "chance") {
    const rng = getBattleRng(state);
    const branch = rng() < effect.probability ? effect.successEffects : effect.failureEffects;
    return branch.reduce((s, nested) => applyCardEffects(s, { ...card, effects: [nested] }, combatTexts), state);
  }

  return applyEffectByKind(effect.kind, state, card, effect, potionMult, combatTexts);
}

export function applyCardEffects(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]): BattleState {
  const potionMult = card.id.endsWith(POTION_CARD_ID_SUFFIX) ? state.talentEffects.potionPotency : 1;
  return card.effects.reduce(
    (currentState, effect) => applySingleEffect(currentState, card, effect, potionMult, combatTexts),
    state,
  );
}
