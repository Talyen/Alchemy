import { resolveBattleSequence } from "../battle-sequence";
import { mergeCombatText } from "../combat-text-events";
import { resolvePendingBattleReactions } from "../enemy-attack-damage";
import { resolveCompanionTurnStart } from "../companion-effects";
import { hasEncounterBenefit } from "../encounter-trait-state";
import { isPlayerDefeated } from "../health-state";
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

function ineffectiveEffectFeedback(effect: BattleCardEffect): CombatTextEvent | null {
  const feedback = { target: "player", kind: "status", stat: "effect", amount: 0, impact: false } as const;
  switch (effect.kind) {
    case "remove-harmful-status":
    case "remove-player-status":
    case "cleanse-player-status-to-damage":
      return { target: "player", kind: "notice", stat: "cleanse", text: "Nothing to Cleanse" };
    case "damage":
      return { ...feedback, target: "enemy", kind: "damage", stat: effect.damageType };
    case "enemy-status":
    case "multiply-enemy-status":
      return { ...feedback, target: "enemy", kind: "multiply", stat: effect.status };
    case "remove-enemy-armor":
      return { ...feedback, target: "enemy", stat: "armor" };
    case "player-status":
      return { ...feedback, stat: effect.status };
    case "heal":
    case "lose-health":
      return { ...feedback, stat: "health" };
    case "restore-mana":
    case "lose-mana":
    case "lose-max-mana":
    case "gain-max-mana":
      return { ...feedback, stat: "mana" };
    case "companion-action":
      return { ...feedback, stat: "companion" };
    case "wish":
    case "self-damage":
    case "random-damage":
    case "summon-companion":
    case "buff-companion":
    case "random-draw":
    case "gain-gold":
    case "draw-cards":
    case "next-hit-crit":
    case "next-hit-leech":
    case "play-next-card-twice":
    case "next-hit-poison":
    case "next-archery-free":
    case "dodge-next-attack":
    case "chance":
    case "repeat-over-turns":
      return feedback;
  }
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
  // Earlier turn-start actions share the output rail, but cannot acknowledge
  // this card or Companion's ineffective action on its behalf.
  context = { ...context, forgeTriggers: new Set<string>() };
  const effectTexts: CombatTextEvent[] = [];
  const potionMult =
    isPotionCard(card) && card.consume && !state.action?.repeatActive
      ? state.talentEffects.potionPotency + (isMixedPotionCard(card) ? state.talentEffects.mixedPotionPotency : 0)
      : 1;
  const result = resolveBattleSequence(
    state,
    card.effects,
    effectTexts,
    (currentState, effect) => applySingleEffect(currentState, card, effect, potionMult, effectTexts, context),
    { kind: "each-step", settle: resolvePendingBattleReactions },
  );
  const primary = card.effects[0];
  if (
    effectTexts.length === 0 &&
    !isPlayerDefeated(state) &&
    primary &&
    (hasEffectApplyHandler(primary.kind) || isRecursiveBattleCardEffectKind(primary.kind))
  ) {
    const feedback = ineffectiveEffectFeedback(primary);
    if (feedback && (feedback.target === "player" || state.enemyHealth > 0)) mergeCombatText(effectTexts, feedback);
  }
  for (const event of effectTexts) mergeCombatText(combatTexts, event);
  return result;
}
