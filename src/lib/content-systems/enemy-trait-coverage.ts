import { COMBAT_ENCOUNTER_TRAIT_IDS } from "./encounter-traits";
import { IRON_HIDE_ARMOR_PER_TURN, REACTION_ONLY_ENEMY_TRAIT_IDS, TRAIT_FORGE_PER_TURN } from "@/lib/game-constants";

export interface EnemyTurnStartGain {
  stat: "forge" | "armor" | "block";
  amount: number;
  everyOtherTurn: boolean;
}

// Single source for which enemy traits the battle turn-start pass handles.
// Battle consumes the gain table; content validation consumes coverage.
// Both stay in sync because both read this module, so a new trait cannot be
// handled at runtime yet fail the authoring gate (or vice versa).
export const ENEMY_TURN_START_GAINS: ReadonlyMap<string, EnemyTurnStartGain> = new Map([
  ["rusting-carapace", { stat: "forge", amount: TRAIT_FORGE_PER_TURN, everyOtherTurn: true }],
  ["iron-hide", { stat: "armor", amount: IRON_HIDE_ARMOR_PER_TURN, everyOtherTurn: true }],
]);

const PASSIVE_ONLY_TRAITS = new Set<string>([
  "cleric",
  "stone-golem",
  "cowardly",
  "reckless",
  "frail",
  "corrodible",
  "lumbering",
  "fault-lines",
  "self-sacrifice",
  "flickering",
  "loose-rubble",
  "concussion",
  "crimson-pulse",
  "radiant-judgment",
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

const REACTION_ONLY_TRAITS: ReadonlySet<string> = new Set<string>([...REACTION_ONLY_ENEMY_TRAIT_IDS]);

export function isEnemyTraitTurnStartCovered(traitId: string): boolean {
  return ENEMY_TURN_START_GAINS.has(traitId) || PASSIVE_ONLY_TRAITS.has(traitId) || REACTION_ONLY_TRAITS.has(traitId);
}

export function collectUncoveredEnemyTraitIds(traitIds: Iterable<string>): string[] {
  return [...new Set(traitIds)].filter((id) => !isEnemyTraitTurnStartCovered(id));
}
