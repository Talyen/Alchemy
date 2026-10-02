import { resolveBattleSequence } from "../battle-sequence";
import { mergeCombatText } from "../combat-text-events";
import { resolvePendingBattleReactions } from "../enemy-attack-damage";
import { resolveCompanionTurnStart } from "../companion-effects";
import { hasEncounterBenefit, isPlayerDefeated } from "../types";
import type { BattleCard, BattleCardEffect, BattleCardEffectKind } from "@/lib/game-data";
import { isMixedPotionCard, isPotionCard } from "@/lib/game-data/cards/card-pools";
import { isRecursiveBattleCardEffectKind } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "../types";
import { getBattleRng, rollChance } from "@/lib/rng";
import { logError } from "../../error-logger";
import type { CardEffectResolutionContext, EffectHandler, EffectHandlers } from "./handler-types";
import { DAMAGE_HANDLERS } from "./damage-handlers";
import { STATUS_HANDLERS } from "./status-handlers";
import { MANA_HEALTH_HANDLERS } from "./mana-health-handlers";
import { SIMPLE_HANDLERS } from "./simple-handlers";

type RegisteredEffectKind = keyof EffectHandlers;

// Companion actions close over applyCardEffects here so companion-effects
// never imports back into the registry.
export const EFFECT_APPLY_BY_KIND: EffectHandlers = {
  ...DAMAGE_HANDLERS,
  ...STATUS_HANDLERS,
  ...MANA_HEALTH_HANDLERS,
  ...SIMPLE_HANDLERS,
  "companion-action": (state, _card, effect, _potionMult, combatTexts) => {
    let nextState = state;
    for (let action = 0; action < effect.amount; action += 1) {
      nextState = resolveCompanionTurnStart(nextState, combatTexts, applyCardEffects);
    }
    return nextState;
  },
};

const registeredKinds = [
  ...[DAMAGE_HANDLERS, STATUS_HANDLERS, MANA_HEALTH_HANDLERS, SIMPLE_HANDLERS].flatMap((group) => Object.keys(group)),
  "companion-action",
];
if (new Set(registeredKinds).size !== registeredKinds.length) {
  throw new Error("Duplicate card effect handler kind");
}

function hasEffectApplyHandler(kind: BattleCardEffectKind): kind is RegisteredEffectKind {
  return !isRecursiveBattleCardEffectKind(kind) && Object.hasOwn(EFFECT_APPLY_BY_KIND, kind);
}

export function applyEffectByKind(
  state: BattleState,
  card: BattleCard,
  effect: BattleCardEffect,
  potionMult: number,
  combatTexts: CombatTextEvent[],
  context?: CardEffectResolutionContext,
): BattleState {
  const kind = effect.kind;
  if (!hasEffectApplyHandler(kind)) {
    console.warn(`[Battle] Missing handler for effect kind: ${kind}`);
    logError(`Missing handler for effect kind: ${kind}`, "battle", { kind });
    return state;
  }
  // TypeScript loses the key/effect correlation when indexing a union of
  // functions. Dispatch derives the key from this same effect; keep the sole
  // widening at that boundary, while tables and direct callers stay typed.
  const apply = EFFECT_APPLY_BY_KIND[kind] as EffectHandler;
  let nextState = apply(state, card, effect, potionMult, combatTexts, context);
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

    return resolveBattleSequence(
      state,
      branch,
      combatTexts,
      (s, nested) => applySingleEffect(s, card, nested, potionMult, combatTexts, context),
      { kind: "each-step", settle: resolvePendingBattleReactions },
    );
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

  return applyEffectByKind(state, card, effect, potionMult, combatTexts, context);
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
  const potionMult =
    isPotionCard(card) && card.consume && !state.action?.repeatActive
      ? state.talentEffects.potionPotency + (isMixedPotionCard(card) ? state.talentEffects.mixedPotionPotency : 0)
      : 1;
  const result = resolveBattleSequence(
    state,
    card.effects,
    combatTexts,
    (currentState, effect) => applySingleEffect(currentState, card, effect, potionMult, combatTexts, context),
    { kind: "each-step", settle: resolvePendingBattleReactions },
  );
  if (
    combatTexts.length === 0 &&
    !isPlayerDefeated(state) &&
    card.effects.length > 0 &&
    !["remove-harmful-status", "remove-player-status", "cleanse-player-status-to-damage"].includes(
      card.effects[0]!.kind,
    ) &&
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
