import { COMBAT_ENCOUNTER_TRAIT_IDS } from "./encounter-traits";
import {
  IRON_HIDE_ARMOR_PER_TURN,
  REACTION_ONLY_ENEMY_TRAIT_IDS,
  TRAIT_DAMAGE_RULES,
  TRAIT_FORGE_PER_TURN,
} from "@/lib/game-constants";

export interface EnemyTurnStartGain {
  stat: "forge" | "armor" | "block";
  amount: number;
  everyOtherTurn: boolean;
}

// Battle consumes the turn-start tables; content validation reads those same
// tables and the damage rules alongside explicitly classified passive traits.
export const ENEMY_TURN_START_GAINS: ReadonlyMap<string, Readonly<EnemyTurnStartGain>> = new Map<
  string,
  Readonly<EnemyTurnStartGain>
>([
  ["rusting-carapace", Object.freeze({ stat: "forge", amount: TRAIT_FORGE_PER_TURN, everyOtherTurn: true })],
  ["iron-hide", Object.freeze({ stat: "armor", amount: IRON_HIDE_ARMOR_PER_TURN, everyOtherTurn: true })],
]);

/** These hits occur on their trait's cadence before the enemy selects its ability. */
export const ENEMY_TURN_START_DAMAGE: Readonly<Record<string, "bleed" | "holy">> = Object.freeze({
  "crimson-pulse": "bleed",
  "radiant-judgment": "holy",
});

const OTHER_COVERED_TRAITS = new Set<string>([
  "cleric",
  "stone-golem",
  "cowardly",
  "self-sacrifice",
  "flickering",
  "loose-rubble",
  "concussion",
  "glacial-shell",
  "glacial-body",
  "minor-holy-vulnerability",
  "tough-hide",
  "vampiric-curse",
  "frozen-apparition",
  "winter-hide",
  "earthen-body",
  "living-armor",
  "gold-trove",
  "starting-block",
  "regeneration",
  "cinder-skin",
  ...TRAIT_DAMAGE_RULES.map((rule) => rule.traitId),
  ...COMBAT_ENCOUNTER_TRAIT_IDS,
  ...REACTION_ONLY_ENEMY_TRAIT_IDS,
]);

export function isEnemyTraitTurnStartCovered(traitId: string): boolean {
  return (
    ENEMY_TURN_START_GAINS.has(traitId) ||
    Object.hasOwn(ENEMY_TURN_START_DAMAGE, traitId) ||
    OTHER_COVERED_TRAITS.has(traitId)
  );
}

export function collectUncoveredEnemyTraitIds(traitIds: Iterable<string>): string[] {
  return [...new Set(traitIds)].filter((id) => !isEnemyTraitTurnStartCovered(id));
}
