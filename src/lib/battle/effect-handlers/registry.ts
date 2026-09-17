import { resolvePendingBattleReactions } from "../enemy-attack-damage";
import { resolveCompanionTurnStart } from "../companion-effects";
import { hasEncounterBenefit, isPlayerDefeated } from "../types";
import type { BattleCard, BattleCardEffect, BattleCardEffectKind } from "@/lib/game-data";
import { isPotionCard } from "@/lib/game-data/cards/card-pools";
import { isRecursiveBattleCardEffectKind } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "../types";
import { getBattleRng, rollChance } from "@/lib/rng";
import { logError } from "../../error-logger";
import type { CardEffectResolutionContext, EffectHandler } from "./handler-types";
import { defineHandler } from "./handler-types";
import {
  applyDamageEffect,
  applySelfDamageEffect,
  applyRandomDamageEffect,
  applyRemoveEnemyArmorEffect,
} from "./damage-handlers";
import {
  applyPlayerStatusEffectHandler,
  applyEnemyStatusEffect,
  applyRemoveHarmfulStatusEffect,
  applyRemovePlayerStatusEffect,
  applyMultiplyEnemyStatusEffect,
  applyCleansePlayerStatusToDamageEffect,
} from "./status-handlers";
import {
  applyRestoreManaEffect,
  applyLoseManaEffect,
  applyGainMaxManaEffect,
  applyLoseMaxManaEffect,
  applyHealEffect,
  applyLoseHealthEffect,
} from "./mana-health-handlers";
import {
  applySummonCompanionEffect,
  applyBuffCompanionEffect,
  FLAG_HANDLERS,
  applyRandomDrawEffect,
  applyGainGoldEffect,
  applyWishEffectHandler,
  applyDrawCardsEffect,
} from "./simple-handlers";

type RegisteredEffectKind = Exclude<BattleCardEffectKind, "chance" | "repeat-over-turns">;

// Defined here (not in simple-handlers) so companion-effects stays free of an
// import back into this registry: this file already imports
// resolveCompanionTurnStart, so the handler can close over applyCardEffects
// lazily without creating a module cycle. See companion.ts binder for the
// non-card entry path.
export const applyCompanionActionEffect = defineHandler(
  "companion-action",
  (state, _card, effect, _potionMult, combatTexts) => {
    let nextState = state;
    for (let action = 0; action < effect.amount; action += 1) {
      nextState = resolveCompanionTurnStart(nextState, combatTexts, applyCardEffects);
    }
    return nextState;
  },
);

export const EFFECT_APPLY_BY_KIND = {
  damage: applyDamageEffect,
  "player-status": applyPlayerStatusEffectHandler,
  "enemy-status": applyEnemyStatusEffect,
  heal: applyHealEffect,
  "restore-mana": applyRestoreManaEffect,
  "lose-mana": applyLoseManaEffect,
  "lose-max-mana": applyLoseMaxManaEffect,
  "gain-max-mana": applyGainMaxManaEffect,
  "gain-gold": applyGainGoldEffect,
  wish: applyWishEffectHandler,
  "summon-companion": applySummonCompanionEffect,
  "remove-harmful-status": applyRemoveHarmfulStatusEffect,
  "remove-player-status": applyRemovePlayerStatusEffect,
  "self-damage": applySelfDamageEffect,
  "buff-companion": applyBuffCompanionEffect,
  "companion-action": applyCompanionActionEffect,
  "random-draw": applyRandomDrawEffect,
  "lose-health": applyLoseHealthEffect,
  "draw-cards": applyDrawCardsEffect,
  "remove-enemy-armor": applyRemoveEnemyArmorEffect,
  "multiply-enemy-status": applyMultiplyEnemyStatusEffect,
  "cleanse-player-status-to-damage": applyCleansePlayerStatusToDamageEffect,
  "random-damage": applyRandomDamageEffect,
  ...FLAG_HANDLERS,
} satisfies Record<RegisteredEffectKind, EffectHandler>;

function hasEffectApplyHandler(kind: BattleCardEffectKind): kind is RegisteredEffectKind {
  return !isRecursiveBattleCardEffectKind(kind) && kind in EFFECT_APPLY_BY_KIND;
}

export function applyEffectByKind(
  kind: BattleCardEffectKind,
  state: BattleState,
  card: BattleCard,
  effect: BattleCardEffect,
  potionMult: number,
  combatTexts: CombatTextEvent[],
  context?: CardEffectResolutionContext,
): BattleState {
  if (!hasEffectApplyHandler(kind)) {
    console.warn(`[Battle] Missing handler for effect kind: ${kind}`);
    logError(`Missing handler for effect kind: ${kind}`, "battle", { kind });
    return state;
  }
  let nextState = EFFECT_APPLY_BY_KIND[kind](state, card, effect, potionMult, combatTexts, context);
  if (kind === "summon-companion" && hasEncounterBenefit(state, "eager-pack")) {
    // Eager Pack is two immediate Companion actions on summon by design
    // ("Your Companions act twice when summoned"), not one.
    nextState = resolveCompanionTurnStart(nextState, combatTexts, applyCardEffects);
    nextState = resolveCompanionTurnStart(nextState, combatTexts, applyCardEffects);
  }
  return resolvePendingBattleReactions(nextState, combatTexts);
}

function applySingleEffect(
  state: BattleState,
  card: BattleCard,
  effect: BattleCardEffect,
  potionMult: number,
  combatTexts: CombatTextEvent[],
  context: CardEffectResolutionContext,
): BattleState {
  if (isPlayerDefeated(state)) return state;
  if (effect.kind === "chance") {
    const rng = getBattleRng(state);
    const branch = rollChance(effect.probability, rng) ? effect.successEffects : effect.failureEffects;

    return branch.reduce((s, nested) => applySingleEffect(s, card, nested, potionMult, combatTexts, context), state);
  }

  if (effect.kind === "repeat-over-turns") {
    return {
      ...state,
      pendingTurnStartEffects: [
        ...state.pendingTurnStartEffects,
        {
          remainingTurns: effect.remainingTurns,
          effects: effect.effects,
          sourceCard: {
            id: card.id,
            ...(card.consume !== undefined ? { consume: card.consume } : {}),
            ...(card.tags !== undefined ? { tags: card.tags } : {}),
          },
        },
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
  const potionMult = isPotionCard(card) && !state.flags.uniqueRepeatActive ? state.talentEffects.potionPotency : 1;
  return card.effects.reduce(
    (currentState, effect) => applySingleEffect(currentState, card, effect, potionMult, combatTexts, context),
    state,
  );
}
