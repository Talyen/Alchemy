import { recordEnemyAbilityActivation } from "./battle-metrics";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { mergeCombatText } from "./combat-text-events";
import type { BestiaryEntry, DifficultyModifier } from "@/lib/game-data";
import { COMBAT_ENCOUNTER_TRAIT_IDS } from "@/lib/content-systems/encounter-traits";
import { logError } from "../error-logger";
import type { BattleState, CombatTextEvent } from "./types";
import { addEnemyMitigation } from "./enemy-mitigation-state";
import { addEnemyStatus } from "./status-state";
import { hasEnemyTrait } from "./encounter-trait-state";
import {
  DIFFICULTY_FORGE_PER_TURN,
  GLACIAL_SURGE_MAX_FREEZE_BONUS,
  IRON_HIDE_ARMOR_PER_TURN,
  REACTION_ONLY_ENEMY_TRAIT_IDS as REACTION_ONLY_IDS,
  TRAIT_FORGE_PER_TURN,
  TRAIT_FREEZE_BONUS_PER_TURN,
} from "../game-constants";

function isEveryOtherTurnScalingTurn(state: { turn: number }): boolean {
  return state.turn % 2 === 0;
}

type FreezeAspect = "regen" | "scaling";

export function isFreezeActiveForAspect(state: BattleState, aspect: FreezeAspect): boolean {
  if (state.enemyCC.freezeSkipTurns <= 0) return false;
  if (aspect === "regen") return state.talentEffects.freezeBlocksRegen;
  return state.talentEffects.freezePreventsEnemyScaling;
}

export function scaleByRoomMultiplier(state: BattleState, value: number): number {
  return Math.round(value * state.roomScalingMultiplier);
}

export function processEnemyRegeneration(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyRegeneration <= 0) return state;
  if (isFreezeActiveForAspect(state, "regen")) return state;
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
  [
    "glacial-shell",
    {
      everyOtherTurn: true,
      handler: (state, combatTexts) => {
        const amount = Math.min(
          TRAIT_FREEZE_BONUS_PER_TURN,
          GLACIAL_SURGE_MAX_FREEZE_BONUS - state.enemyStatuses.freezeBonus,
        );
        if (amount <= 0) return state;
        mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "freezeBonus", amount });
        return addEnemyStatus(state, "freezeBonus", amount);
      },
    },
  ],
  ["cleric", { handler: makeMitigationHandler("block", 1), everyOtherTurn: false }],
  ["stone-golem", { handler: makeMitigationHandler("block", 1), everyOtherTurn: false }],
]);

// Null means the modifier is handled during setup or damage resolution.
// Exhaustiveness makes adding a difficulty kind require an explicit classification.
const difficultyTurnStartHandlers = {
  "enemy-gains-forge-each-turn": makeMitigationHandler("forge", DIFFICULTY_FORGE_PER_TURN),
  "enemy-starting-armor": null,
  "increase-enemy-physical-damage": null,
  "increase-enemy-damage": null,
  "increase-enemy-status": null,
  "enemy-attacks-gain-leech": null,
  "start-block": null,
  "start-max-mana": null,
  "gold-multiplier": null,
  "start-companion": null,
  "enemy-health-multiplier": null,
  "enemy-damage-multiplier": null,
} satisfies Record<DifficultyModifier["kind"], EnemyTurnStartHandler | null>;

const PASSIVE_ONLY_TRAITS = new Set<string>([
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

const ALL_DIFFICULTY_MODIFIER_KINDS = Object.keys(difficultyTurnStartHandlers) as Array<DifficultyModifier["kind"]>;
export const DIFFICULTY_TURN_START_MODIFIER_KINDS = ALL_DIFFICULTY_MODIFIER_KINDS.filter(
  (kind) => difficultyTurnStartHandlers[kind] !== null,
);
export const PASSIVE_ONLY_DIFFICULTY_MODIFIER_KINDS = ALL_DIFFICULTY_MODIFIER_KINDS.filter(
  (kind) => difficultyTurnStartHandlers[kind] === null,
);

function isEnemyTraitTurnStartCovered(traitId: string): boolean {
  return (
    enemyTraitTurnStartHandlers.has(traitId) || PASSIVE_ONLY_TRAITS.has(traitId) || REACTION_ONLY_TRAITS.has(traitId)
  );
}

export function collectUncoveredEnemyTraitIds(traitIds: Iterable<string>): string[] {
  return [...new Set(traitIds)].filter((id) => !isEnemyTraitTurnStartCovered(id));
}

export function collectUncoveredDifficultyModifierKinds(
  kinds: Iterable<DifficultyModifier["kind"]> = ALL_DIFFICULTY_MODIFIER_KINDS,
): Array<DifficultyModifier["kind"]> {
  return [...new Set(kinds)].filter((kind) => !Object.hasOwn(difficultyTurnStartHandlers, kind));
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
    return traitHandler.handler(recordEnemyAbilityActivation(state, trait.id), combatTexts);
  }
  if (!PASSIVE_ONLY_TRAITS.has(trait.id) && !REACTION_ONLY_TRAITS.has(trait.id)) {
    console.warn(`[Battle] No turn-start handler for trait: ${trait.id}`);
    reportHandlerFailure(`No turn-start handler for trait ${trait.id}`, new Error("uncovered enemy trait"), {
      traitId: trait.id,
    });
  }
  return state;
}

function processDifficultyModifier(
  modifier: DifficultyModifier,
  state: BattleState,
  combatTexts: CombatTextEvent[],
  scalingBlocked: boolean,
): BattleState {
  if (!Object.hasOwn(difficultyTurnStartHandlers, modifier.kind)) {
    console.warn(`[Battle] No turn-start handler for difficulty modifier: ${modifier.kind}`);
    reportHandlerFailure(
      `No turn-start handler for difficulty modifier ${modifier.kind}`,
      new Error("uncovered difficulty modifier"),
    );
    return state;
  }
  const handler = difficultyTurnStartHandlers[modifier.kind];
  if (!handler) return state;
  if (modifier.kind === "enemy-gains-forge-each-turn" && scalingBlocked) return state;
  return handler(state, combatTexts);
}

export function processEnemyTraits(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;
  const scalingBlocked = isFreezeActiveForAspect(nextState, "scaling");

  if (!scalingBlocked) {
    for (const trait of nextState.currentEnemy.traits) {
      try {
        nextState = processTraitHandler(trait, nextState, combatTexts);
      } catch (err) {
        if (import.meta.env.DEV) throw err;
        reportHandlerFailure(`Enemy trait handler for ${trait.id}`, err);
      }
    }
  }

  for (const modifier of nextState.difficultyModifiers) {
    try {
      nextState = processDifficultyModifier(modifier, nextState, combatTexts, scalingBlocked);
    } catch (err) {
      if (import.meta.env.DEV) throw err;
      reportHandlerFailure(`Difficulty modifier handler for ${modifier.kind}`, err, { kind: modifier.kind });
    }
  }

  return nextState;
}
