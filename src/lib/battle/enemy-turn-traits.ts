import { recordEnemyAbilityActivation } from "./battle-metrics";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { mergeCombatText } from "./combat-text-events";
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

const turnStartGains = new Map<string, { stat: "forge" | "armor" | "block"; amount: number; everyOtherTurn: boolean }>([
  ["rusting-carapace", { stat: "forge", amount: TRAIT_FORGE_PER_TURN, everyOtherTurn: true }],
  ["iron-hide", { stat: "armor", amount: IRON_HIDE_ARMOR_PER_TURN, everyOtherTurn: true }],
  ["cleric", { stat: "block", amount: 1, everyOtherTurn: false }],
  ["stone-golem", { stat: "block", amount: 1, everyOtherTurn: false }],
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

function isEnemyTraitTurnStartCovered(traitId: string): boolean {
  return turnStartGains.has(traitId) || PASSIVE_ONLY_TRAITS.has(traitId) || REACTION_ONLY_TRAITS.has(traitId);
}

export function collectUncoveredEnemyTraitIds(traitIds: Iterable<string>): string[] {
  return [...new Set(traitIds)].filter((id) => !isEnemyTraitTurnStartCovered(id));
}

export function processEnemyTraits(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;
  for (const trait of state.currentEnemy.traits) {
    const gain = turnStartGains.get(trait.id);
    if (!gain) {
      if (!isEnemyTraitTurnStartCovered(trait.id)) {
        logError(`No turn-start handler for trait ${trait.id}`, "battle", { traitId: trait.id });
        if (import.meta.env.DEV) throw new Error(`Uncovered enemy trait: ${trait.id}`);
      }
      continue;
    }
    if (gain.everyOtherTurn && state.turn % 2 !== 0) continue;
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: gain.stat, amount: gain.amount });
    nextState = recordEnemyAbilityActivation(addEnemyMitigation(nextState, gain.stat, gain.amount), trait.id);
  }
  return nextState;
}
