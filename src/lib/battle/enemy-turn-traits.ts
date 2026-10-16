import { recordEnemyAbilityActivation } from "./battle-metrics";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { mergeCombatText } from "./combat-text-events";
import type { BestiaryEntry } from "@/lib/game-data";
import { COMBAT_ENCOUNTER_TRAIT_IDS } from "@/lib/content-systems/encounter-traits";
import { logError } from "../error-logger";
import type { BattleState, CombatTextEvent } from "./types";
import { addEnemyMitigation } from "./enemy-mitigation-state";
import { hasEnemyTrait } from "./encounter-trait-state";
import {
  IRON_HIDE_ARMOR_PER_TURN,
  REACTION_ONLY_ENEMY_TRAIT_IDS as REACTION_ONLY_IDS,
  TRAIT_FORGE_PER_TURN,
} from "../game-constants";

function isEveryOtherTurnScalingTurn(state: { turn: number }): boolean {
  return state.turn % 2 === 0;
}

export function scaleByRoomMultiplier(state: BattleState, value: number): number {
  return Math.round(value * state.roomScalingMultiplier);
}

export function processEnemyRegeneration(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyRegeneration <= 0) return state;
  let nextState = applyEnemyHealingWithCombatText(state, state.enemyRegeneration, combatTexts);
  if (nextState.enemyHealth > state.enemyHealth && hasEnemyTrait(state, "regeneration"))
    nextState = recordEnemyAbilityActivation(nextState, "regeneration");
  return nextState;
}

type EnemyTurnStartHandler = (state: BattleState, combatTexts: CombatTextEvent[]) => BattleState;

function makeMitigationHandler(stat: "forge" | "armor" | "block", amount: number): EnemyTurnStartHandler {
  return (state, combatTexts) => {
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat, amount });
    return addEnemyMitigation(state, stat, amount);
  };
}

interface EnemyTurnStartTrait {
  handler: EnemyTurnStartHandler;
  everyOtherTurn: boolean;
}

const enemyTraitTurnStartHandlers = new Map<string, EnemyTurnStartTrait>([
  ["rusting-carapace", { handler: makeMitigationHandler("forge", TRAIT_FORGE_PER_TURN), everyOtherTurn: true }],
  ["iron-hide", { handler: makeMitigationHandler("armor", IRON_HIDE_ARMOR_PER_TURN), everyOtherTurn: true }],
  ["cleric", { handler: makeMitigationHandler("block", 1), everyOtherTurn: false }],
  ["stone-golem", { handler: makeMitigationHandler("block", 1), everyOtherTurn: false }],
]);

const PASSIVE_ONLY_TRAITS = new Set<string>([
  "glacial-shell",
  "brittle-bones",
  "glacial-body",
  "minor-freeze-vulnerability",
  "cold-blooded",
  "minor-holy-vulnerability",
  "tough-hide",
  "vampiric-curse",
  "frozen-apparition",
  "winter-hide",
  "earthen-body",
  "holy-vulnerability",
  "burn-resistance",
  "burn-vulnerability",
  "living-armor",
  "thick-hide",
  "poison-resistance",
  "gold-trove",
  "starting-block",
  "regeneration",
  "freeze-vulnerability",
  "amorphous",
  "cinder-skin",
  ...COMBAT_ENCOUNTER_TRAIT_IDS,
]);

const REACTION_ONLY_TRAITS: ReadonlySet<string> = new Set<string>([...REACTION_ONLY_IDS]);

export const ENEMY_TRAIT_TURN_START_HANDLER_IDS = [...enemyTraitTurnStartHandlers.keys()];

export const PASSIVE_ONLY_ENEMY_TRAIT_IDS = [...PASSIVE_ONLY_TRAITS];

export const REACTION_ONLY_ENEMY_TRAIT_IDS = [...REACTION_ONLY_TRAITS];

function isEnemyTraitTurnStartCovered(traitId: string): boolean {
  return (
    enemyTraitTurnStartHandlers.has(traitId) || PASSIVE_ONLY_TRAITS.has(traitId) || REACTION_ONLY_TRAITS.has(traitId)
  );
}

export function collectUncoveredEnemyTraitIds(traitIds: Iterable<string>): string[] {
  return [...new Set(traitIds)].filter((id) => !isEnemyTraitTurnStartCovered(id));
}

function reportHandlerFailure(source: string, err: unknown, context?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err);
  logError(`${source} failed: ${message}`, "battle", context);
  if (import.meta.env.DEV) throw err;
}

function processTraitHandler(
  trait: BestiaryEntry["traits"][number],
  state: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  const traitHandler = enemyTraitTurnStartHandlers.get(trait.id);
  if (traitHandler) {
    if (traitHandler.everyOtherTurn && !isEveryOtherTurnScalingTurn(state)) return state;
    const updated = traitHandler.handler(state, combatTexts);
    return updated === state ? state : recordEnemyAbilityActivation(updated, trait.id);
  }
  if (!PASSIVE_ONLY_TRAITS.has(trait.id) && !REACTION_ONLY_TRAITS.has(trait.id)) {
    console.warn(`[Battle] No turn-start handler for trait: ${trait.id}`);
    reportHandlerFailure(`No turn-start handler for trait ${trait.id}`, new Error("uncovered enemy trait"), {
      traitId: trait.id,
    });
  }
  return state;
}

export function processEnemyTraits(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;
  for (const trait of nextState.currentEnemy.traits) {
    try {
      nextState = processTraitHandler(trait, nextState, combatTexts);
    } catch (err) {
      if (import.meta.env.DEV) throw err;
      reportHandlerFailure(`Enemy trait handler for ${trait.id}`, err);
    }
  }

  return nextState;
}
