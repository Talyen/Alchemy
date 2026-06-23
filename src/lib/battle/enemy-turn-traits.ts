// Enemy trait and difficulty turn-start handlers plus regeneration.
import { mergeCombatText } from "./combat-text";
import type { DifficultyModifier } from "@/lib/game-data";
import { COMBAT_ENCOUNTER_TRAIT_IDS } from "@/lib/content-systems/encounter-traits";
import { logError } from "../error-logger";
import { clampHealth, type BattleState, type CombatTextEvent, addEnemyMitigation } from "./types";
import {
  DIFFICULTY_FORGE_PER_TURN,
  HALF_DIVISOR,
  IRON_HIDE_ARMOR_PER_TURN,
  IRON_HIDE_BURN_BONUS_PER_TURN,
  TRAIT_FORGE_PER_TURN,
  TRAIT_FREEZE_BONUS_PER_TURN,
} from "../game-constants";
import { ENEMY_TURN_CONSTANTS, isFreezeActiveForAspect, scaleByRoomMultiplier } from "./enemy-turn-utils";

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
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: healAmount });
  return { ...state, enemyHealth: clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth) };
}

type EnemyTurnStartHandler = (
  state: BattleState,
  combatTexts: CombatTextEvent[],
  options?: { traitRoll?: number },
) => BattleState;

const enemyTraitTurnStartHandlers: Record<string, EnemyTurnStartHandler> = {
  "rusting-carapace": (state) => {
    const scaledForge = scaleByRoomMultiplier(state, TRAIT_FORGE_PER_TURN);
    return addEnemyMitigation(state, "forge", scaledForge);
  },
  "iron-hide": (state, combatTexts, options) => {
    const scaledArmor = scaleByRoomMultiplier(state, IRON_HIDE_ARMOR_PER_TURN);
    const scaledForge = scaleByRoomMultiplier(state, TRAIT_FORGE_PER_TURN);
    const scaledBurn = scaleByRoomMultiplier(state, IRON_HIDE_BURN_BONUS_PER_TURN);
    const roll = options?.traitRoll ?? state.rng();
    const choice = Math.trunc(roll * ENEMY_TURN_CONSTANTS.IRON_HIDE_OPTIONS_COUNT);
    if (choice === 0) {
      mergeCombatText(combatTexts, {
        target: "enemy",
        kind: "status",
        stat: "armor",
        amount: scaledArmor,
      });
      return addEnemyMitigation(state, "armor", scaledArmor);
    } else if (choice === 1) {
      mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "forge", amount: scaledForge });
      return addEnemyMitigation(state, "forge", scaledForge);
    }
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "notice",
      stat: "burn",
      text: `+${scaledBurn} Burn Dmg`,
    });
    return addEnemyMitigation(state, "burnBonus", scaledBurn);
  },
  "glacial-shell": (state) => {
    const scaledFreeze = scaleByRoomMultiplier(state, TRAIT_FREEZE_BONUS_PER_TURN);
    return addEnemyMitigation(state, "freezeBonus", scaledFreeze);
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
        const handler = enemyTraitTurnStartHandlers[trait.id];
        if (handler) {
          nextState = handler(nextState, combatTexts, { traitRoll });
        } else if (!PASSIVE_ONLY_TRAITS.has(trait.id)) {
          console.warn(`[Enemy Turn] No turn-start handler for trait: ${trait.id}`);
          logError(`No turn-start handler for trait: ${trait.id}`, "battle", { state: nextState });
          if (import.meta.env.DEV) throw new Error(`No turn-start handler for trait: ${trait.id}`);
        }
      } catch (err) {
        logError(`Enemy trait handler failed: ${(err as Error).message}`, "battle", { traitId: trait.id });
      }
    }
  }

  for (const modifier of nextState.difficultyModifiers) {
    const handler = difficultyTurnStartHandlers[modifier.kind];
    if (!handler) {
      if (!PASSIVE_ONLY_MODIFIERS.has(modifier.kind)) {
        console.warn(`[Enemy Turn] No turn-start handler for difficulty modifier: ${modifier.kind}`);
        logError(`No turn-start handler for difficulty modifier: ${modifier.kind}`, "battle", { state: nextState });
        if (import.meta.env.DEV) throw new Error(`No turn-start handler for difficulty modifier: ${modifier.kind}`);
      }
      continue;
    }
    if (modifier.kind === "enemy-gains-forge-each-turn" && scalingBlocked) continue;
    nextState = handler(nextState, combatTexts);
  }

  return nextState;
}
