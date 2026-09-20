import { mergeCombatText } from "../combat-text-events";
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
import { DAMAGE_HANDLERS } from "./damage-handlers";
import { STATUS_HANDLERS } from "./status-handlers";
import { MANA_HEALTH_HANDLERS } from "./mana-health-handlers";
import { SIMPLE_HANDLERS } from "./simple-handlers";

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

const handlerGroups = [
  DAMAGE_HANDLERS,
  STATUS_HANDLERS,
  MANA_HEALTH_HANDLERS,
  SIMPLE_HANDLERS,
  { "companion-action": applyCompanionActionEffect },
] as const;
const registeredKinds = handlerGroups.flatMap((group) => Object.keys(group));
if (new Set(registeredKinds).size !== registeredKinds.length) {
  throw new Error("Duplicate card effect handler kind");
}

export const EFFECT_APPLY_BY_KIND = {
  ...DAMAGE_HANDLERS,
  ...STATUS_HANDLERS,
  ...MANA_HEALTH_HANDLERS,
  ...SIMPLE_HANDLERS,
  "companion-action": applyCompanionActionEffect,
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
    mergeCombatText(combatTexts, { target: "player", kind: "notice", stat: "scheduled", text: "" });
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
  const result = card.effects.reduce(
    (currentState, effect) => applySingleEffect(currentState, card, effect, potionMult, combatTexts, context),
    state,
  );
  if (
    combatTexts.length === 0 &&
    !isPlayerDefeated(state) &&
    card.effects.length > 0 &&
    (hasEffectApplyHandler(card.effects[0]!.kind) || isRecursiveBattleCardEffectKind(card.effects[0]!.kind))
  ) {
    const primary = card.effects[0]!;
    const stat =
      primary.kind === "damage"
        ? primary.damageType
        : primary.kind === "heal" || primary.kind === "lose-health"
          ? "health"
          : primary.kind === "restore-mana" ||
              primary.kind === "lose-mana" ||
              primary.kind === "lose-max-mana" ||
              primary.kind === "gain-max-mana"
            ? "mana"
            : primary.kind === "remove-harmful-status" ||
                primary.kind === "remove-player-status" ||
                primary.kind === "cleanse-player-status-to-damage"
              ? "cleanse"
              : primary.kind === "remove-enemy-armor"
                ? "armor"
                : primary.kind === "companion-action"
                  ? "companion"
                  : primary.kind === "player-status" ||
                      primary.kind === "enemy-status" ||
                      primary.kind === "multiply-enemy-status"
                    ? primary.status
                    : "effect";
    const target =
      primary.kind === "damage" ||
      primary.kind === "remove-enemy-armor" ||
      primary.kind === "multiply-enemy-status" ||
      primary.kind === "enemy-status"
        ? "enemy"
        : "player";
    mergeCombatText(combatTexts, {
      target,
      kind:
        primary.kind === "damage"
          ? "damage"
          : primary.kind === "multiply-enemy-status" || primary.kind === "enemy-status"
            ? "multiply"
            : "status",
      stat,
      amount: 0,
      impact: false,
    });
  }
  return result;
}
