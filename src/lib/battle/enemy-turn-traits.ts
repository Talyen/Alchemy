// Enemy trait and difficulty turn-start handlers plus regeneration.
import { mergeCombatText } from "./combat-text";
import type { BestiaryEntry, DifficultyModifier } from "@/lib/game-data";
import { COMBAT_ENCOUNTER_TRAIT_IDS } from "@/lib/content-systems/encounter-traits";
import { logError } from "../error-logger";
import { clampHealth, type BattleState, type CombatTextEvent, addEnemyMitigation, addEnemyStatus } from "./types";
import {
  DIFFICULTY_FORGE_PER_TURN,
  HALF_DIVISOR,
  IRON_HIDE_ARMOR_PER_TURN,
  IRON_HIDE_BURN_BONUS_PER_TURN,
  TRAIT_FORGE_PER_TURN,
  TRAIT_FREEZE_BONUS_PER_TURN,
} from "../game-constants";
import { ENEMY_TURN_CONSTANTS, isEveryOtherTurnScalingTurn, isFreezeActiveForAspect } from "./enemy-turn-utils";
import { paceCombatMagnitude } from "./fight-pacing";

export function processEnemyRegeneration(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyRegeneration <= 0) return state;
  if (isFreezeActiveForAspect(state, "regen")) return state;
  let healAmount = state.enemyRegeneration;
  if (state.enemyStatuses.poison > 0 && state.talentEffects.poisonHalvesHealing) {
    healAmount = Math.round(healAmount / HALF_DIVISOR);
  }
  if (state.enemyStatuses.bleed > 0 && state.talentEffects.bleedHalvesEnemyHealing) {
    healAmount = Math.round(healAmount / HALF_DIVISOR);
  }
  if (healAmount <= 0) return state;
  const pacedHeal = paceCombatMagnitude(state, healAmount, "enemy");
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: pacedHeal });
  return { ...state, enemyHealth: clampHealth(state.enemyHealth, pacedHeal, state.enemyMaxHealth) };
}

const EVERY_OTHER_TURN_TRAITS = new Set(["rusting-carapace", "iron-hide", "glacial-shell"]);

type EnemyTurnStartHandler = (
  state: BattleState,
  combatTexts: CombatTextEvent[],
  options?: { traitRoll?: number },
) => BattleState;

const enemyTraitTurnStartHandlers: Record<string, EnemyTurnStartHandler> = {
  "rusting-carapace": (state, combatTexts) => {
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "forge", amount: TRAIT_FORGE_PER_TURN });
    return addEnemyMitigation(state, "forge", TRAIT_FORGE_PER_TURN);
  },
  "iron-hide": (state, combatTexts, options) => {
    const choice = Math.trunc((options?.traitRoll ?? state.rng()) * ENEMY_TURN_CONSTANTS.IRON_HIDE_OPTIONS_COUNT);
    if (choice === 0) {
      mergeCombatText(combatTexts, {
        target: "enemy",
        kind: "status",
        stat: "armor",
        amount: IRON_HIDE_ARMOR_PER_TURN,
      });
      return addEnemyMitigation(state, "armor", IRON_HIDE_ARMOR_PER_TURN);
    } else if (choice === 1) {
      mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "forge", amount: TRAIT_FORGE_PER_TURN });
      return addEnemyMitigation(state, "forge", TRAIT_FORGE_PER_TURN);
    }
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "status",
      stat: "burnBonus",
      amount: IRON_HIDE_BURN_BONUS_PER_TURN,
    });
    return addEnemyStatus(state, "burnBonus", IRON_HIDE_BURN_BONUS_PER_TURN);
  },
  "glacial-shell": (state, combatTexts) => {
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "status",
      stat: "freezeBonus",
      amount: TRAIT_FREEZE_BONUS_PER_TURN,
    });
    return addEnemyStatus(state, "freezeBonus", TRAIT_FREEZE_BONUS_PER_TURN);
  },
};

const difficultyTurnStartHandlers: Partial<Record<DifficultyModifier["kind"], EnemyTurnStartHandler>> = {
  "enemy-gains-forge-each-turn": (state, combatTexts) => {
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "forge", amount: DIFFICULTY_FORGE_PER_TURN });
    return addEnemyMitigation(state, "forge", DIFFICULTY_FORGE_PER_TURN);
  },
};

// Traits whose behavior is purely passive (damage multipliers, one-time setup, etc.)
// and intentionally have no turn-start handler. Excludes warnings to reduce noise.
const PASSIVE_ONLY_TRAITS = new Set([
  "brittle-bones",
  "trinket-hoarder",
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

// Difficulty modifiers whose behavior is purely passive (applied at battle start or checked elsewhere)
// and intentionally have no turn-start handler.
const PASSIVE_ONLY_MODIFIERS = new Set<DifficultyModifier["kind"]>([
  "enemy-starting-armor",
  "increase-enemy-physical-damage",
  "increase-enemy-damage",
  "increase-enemy-status",
  "enemy-attacks-gain-leech",
  "start-block",
  "start-max-mana",
  "gold-multiplier",
  "start-companion",
  "enemy-health-multiplier",
  "enemy-damage-multiplier",
]);

/** Turn-start handler ids — used by tests and startup validation. */
export const ENEMY_TRAIT_TURN_START_HANDLER_IDS = Object.keys(enemyTraitTurnStartHandlers);

/** Passive enemy traits with no turn-start handler — used by tests and startup validation. */
export const PASSIVE_ONLY_ENEMY_TRAIT_IDS = [...PASSIVE_ONLY_TRAITS];

/** Difficulty modifiers with turn-start handlers — used by tests and startup validation. */
export const DIFFICULTY_TURN_START_MODIFIER_KINDS = Object.keys(difficultyTurnStartHandlers) as Array<
  DifficultyModifier["kind"]
>;

/** Passive difficulty modifiers with no turn-start handler — used by tests and startup validation. */
export const PASSIVE_ONLY_DIFFICULTY_MODIFIER_KINDS = [...PASSIVE_ONLY_MODIFIERS];

const ALL_DIFFICULTY_MODIFIER_KINDS: Array<DifficultyModifier["kind"]> = [
  "enemy-starting-armor",
  "enemy-gains-forge-each-turn",
  "increase-enemy-physical-damage",
  "increase-enemy-damage",
  "increase-enemy-status",
  "enemy-attacks-gain-leech",
  "start-block",
  "start-max-mana",
  "gold-multiplier",
  "start-companion",
  "enemy-health-multiplier",
  "enemy-damage-multiplier",
];

function isEnemyTraitTurnStartCovered(traitId: string): boolean {
  return traitId in enemyTraitTurnStartHandlers || PASSIVE_ONLY_TRAITS.has(traitId);
}

function isDifficultyModifierTurnStartCovered(kind: DifficultyModifier["kind"]): boolean {
  return kind in difficultyTurnStartHandlers || PASSIVE_ONLY_MODIFIERS.has(kind);
}

export function collectUncoveredEnemyTraitIds(traitIds: Iterable<string>): string[] {
  return [...new Set(traitIds)].filter((id) => !isEnemyTraitTurnStartCovered(id));
}

export function collectUncoveredDifficultyModifierKinds(
  kinds: Iterable<DifficultyModifier["kind"]> = ALL_DIFFICULTY_MODIFIER_KINDS,
): Array<DifficultyModifier["kind"]> {
  return [...new Set(kinds)].filter((kind) => !isDifficultyModifierTurnStartCovered(kind));
}

function processTraitHandler(
  trait: BestiaryEntry["traits"][number],
  state: BattleState,
  combatTexts: CombatTextEvent[],
  traitRoll: number,
): BattleState {
  const handler = enemyTraitTurnStartHandlers[trait.id];
  if (handler) {
    if (EVERY_OTHER_TURN_TRAITS.has(trait.id) && !isEveryOtherTurnScalingTurn(state)) return state;
    return handler(state, combatTexts, { traitRoll });
  }
  if (!PASSIVE_ONLY_TRAITS.has(trait.id)) {
    console.warn(`[Enemy Turn] No turn-start handler for trait: ${trait.id}`);
    logError(`No turn-start handler for trait: ${trait.id}`, "battle", { state });
    if (import.meta.env.DEV) throw new Error(`No turn-start handler for trait: ${trait.id}`);
  }
  return state;
}

function processDifficultyModifier(
  modifier: DifficultyModifier,
  state: BattleState,
  combatTexts: CombatTextEvent[],
  scalingBlocked: boolean,
): BattleState {
  const handler = difficultyTurnStartHandlers[modifier.kind];
  if (!handler) {
    if (!PASSIVE_ONLY_MODIFIERS.has(modifier.kind)) {
      console.warn(`[Enemy Turn] No turn-start handler for difficulty modifier: ${modifier.kind}`);
      logError(`No turn-start handler for difficulty modifier: ${modifier.kind}`, "battle", { state });
      if (import.meta.env.DEV) throw new Error(`No turn-start handler for difficulty modifier: ${modifier.kind}`);
    }
    return state;
  }
  if (modifier.kind === "enemy-gains-forge-each-turn" && scalingBlocked) return state;
  return handler(state, combatTexts);
}

export function processEnemyTraits(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  options?: { traitRoll?: number },
) {
  let nextState = state;
  const scalingBlocked = isFreezeActiveForAspect(nextState, "scaling");
  const traitRoll = options?.traitRoll ?? nextState.rng();

  if (!scalingBlocked) {
    for (const trait of nextState.currentEnemy.traits) {
      try {
        nextState = processTraitHandler(trait, nextState, combatTexts, traitRoll);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError(`Enemy trait handler failed: ${message}`, "battle", { traitId: trait.id });
        if (import.meta.env.DEV) throw err;
      }
    }
  }

  for (const modifier of nextState.difficultyModifiers) {
    nextState = processDifficultyModifier(modifier, nextState, combatTexts, scalingBlocked);
  }

  return nextState;
}
