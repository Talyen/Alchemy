// Enemy trait and difficulty turn-start handlers plus regeneration.
import { mergeCombatText } from "./combat-text";
import type { DifficultyModifier } from "@/lib/game-data";
import { logError } from "../error-logger";
import { clampHealth, type BattleState, type CombatTextEvent, addEnemyMitigation } from "./types";
import {
  DIFFICULTY_FORGE_PER_TURN,
  HALF_DIVISOR,
  IRON_HIDE_ARMOR_PER_TURN,
  IRON_HIDE_BURN_BONUS_PER_TURN,
  LABYRINTH_BURNING_GROUND_DAMAGE,
  LABYRINTH_LEECH_HEAL,
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
  "labyrinth-leeching": (state, combatTexts) => {
    if (isFreezeActiveForAspect(state, "regen")) return state;
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "health", amount: LABYRINTH_LEECH_HEAL });
    return {
      ...state,
      enemyHealth: clampHealth(state.enemyHealth, LABYRINTH_LEECH_HEAL, state.enemyMaxHealth),
    };
  },
  "labyrinth-burning-ground": (state, combatTexts) => {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "burn",
      amount: LABYRINTH_BURNING_GROUND_DAMAGE,
    });
    return {
      ...state,
      playerStatuses: {
        ...state.playerStatuses,
        burn: state.playerStatuses.burn + LABYRINTH_BURNING_GROUND_DAMAGE,
      },
    };
  },
};

function reduceSkipTurns(state: BattleState): BattleState {
  // Reduced AFTER traits so isScalingBlocked still sees the pre-reduction freeze
  // count for one more turn — the enemy doesn't benefit from freeze reduction in the
  // same turn freeze was applied.
  return {
    ...state,
    enemyStunSkipTurns: Math.max(0, state.enemyStunSkipTurns - 1),
    enemyFreezeSkipTurns: Math.max(0, state.enemyFreezeSkipTurns - 1),
  };
}

// Death's Door grants a grace period of (1 + extension) full player turns after hitting 0 HP.
// The grace turns counter is initialized on trigger and decremented when a player recovery turn begins.
// resolveDeathsDoorEndOfEnemyTurn runs at the end of the enemy phase and deactivates the grace window
// once the remaining turns counter reaches 0 or less.
function resolveDeathsDoorEndOfEnemyTurn(state: BattleState): BattleState {
  if (!state.deathsDoorActive) return state;
  if (state.playerHealth > 0) {
    return {
      ...state,
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: null,
    };
  }

  const remaining = computeDeathsDoorGraceRemaining(state);
  if (remaining <= 0) {
    return {
      ...state,
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: null,
    };
  }
  return state;
}

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
]);

// Difficulty modifiers whose behavior is purely passive (applied at battle start or checked elsewhere)
// and intentionally have no turn-start handler.
const PASSIVE_ONLY_MODIFIERS = new Set([
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
  "labyrinth-sturdy",
  "labyrinth-null-field",
]);

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
