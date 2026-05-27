/**
 * Labyrinth modifiers applied to combat/elite nodes and victory rewards.
 * Depends on: src/lib/game-data/difficulties.ts, src/lib/content-systems/types.ts, map-generation.ts
 * Depended on by: map-generation.ts, labyrinth-map-screen.tsx
 */

import type { DifficultyModifier } from "@/lib/game-data";
import type { LabyrinthModifier, LabyrinthModifierKind } from "../types";
import { shuffle as shuffleWithRng } from "@/lib/utils";
import {
  LABYRINTH_BURNING_GROUND_DAMAGE,
  LABYRINTH_LEECH_HEAL,
  LABYRINTH_STURDY_HEALTH_PCT,
  LABYRINTH_REWARD_CONFIG,
} from "@/lib/game-constants";

const MODIFIER_CONFIG = {
  ARMORED_AMOUNT: 2,
  OVERWHELMING_AMOUNT: 2,
  STURDY_HEALTH_PCT: LABYRINTH_STURDY_HEALTH_PCT,
  BURNING_GROUND_DAMAGE: LABYRINTH_BURNING_GROUND_DAMAGE,
  LEECHING_HEAL: LABYRINTH_LEECH_HEAL,
  GENEROUS_GOLD_MULTIPLIER: LABYRINTH_REWARD_CONFIG.generousGoldBonusFraction,
  COMBAT_REWARD_MODIFIER_CHANCE: 0.5,
  COMBAT_ENEMY_MODIFIER_COUNT: 1,
  ELITE_ENEMY_MODIFIER_COUNT: 2,
} as const;

export const ALL_LABYRINTH_MODIFIERS: Record<LabyrinthModifierKind, LabyrinthModifier> = {
  armored: {
    kind: "armored",
    label: "Armored",
    description: `Enemies start with ${MODIFIER_CONFIG.ARMORED_AMOUNT} Armor`,
  },
  sturdy: {
    kind: "sturdy",
    label: "Sturdy",
    description: `Enemies have ${MODIFIER_CONFIG.STURDY_HEALTH_PCT}% more Health`,
  },
  "burning-ground": {
    kind: "burning-ground",
    label: "Scorching",
    description: `Take ${MODIFIER_CONFIG.BURNING_GROUND_DAMAGE} Burn damage at the end of each turn`,
  },
  overwhelming: {
    kind: "overwhelming",
    label: "Overwhelming",
    description: `Enemies deal ${MODIFIER_CONFIG.OVERWHELMING_AMOUNT} more damage`,
  },
  leeching: {
    kind: "leeching",
    label: "Vampiric",
    description: `Enemies heal ${MODIFIER_CONFIG.LEECHING_HEAL} Health on their turn`,
  },
  "null-field": {
    kind: "null-field",
    label: "Status Resistance",
    description: "Status effects are applied at half value",
  },
  collector: {
    kind: "collector",
    label: "Collector",
    description: "Guaranteed trinket reward from this encounter",
  },
  generous: {
    kind: "generous",
    label: "Generous",
    description: `Victory gold is increased by ${MODIFIER_CONFIG.GENEROUS_GOLD_MULTIPLIER * 100}%`,
  },
  alchemist: {
    kind: "alchemist",
    label: "Alchemist",
    description: "Gain a random potion alongside the normal reward",
  },
  scavenger: {
    kind: "scavenger",
    label: "Scavenger",
    description: "Material loot from this encounter is doubled",
  },
  companion: {
    kind: "companion",
    label: "Companion",
    description: "Choose a free Companion card after the battle",
  },
};

// Modifier kinds that affect rewards (not battle difficulty).
export const REWARD_MODIFIER_KINDS: ReadonlySet<LabyrinthModifierKind> = new Set([
  "collector",
  "generous",
  "alchemist",
  "scavenger",
  "companion",
]);

// Converts Labyrinth modifier kind strings into DifficultyModifier objects
// consumed by the battle engine. Reuses campaign modifier kinds where applicable.
// Reward modifiers are silently skipped — they do not affect battle difficulty.
export function labyrinthModifiersToDifficulty(modifiers: string[]): DifficultyModifier[] {
  const result: DifficultyModifier[] = [];
  for (const m of modifiers) {
    switch (m) {
      case "armored":
        result.push({ kind: "enemy-starting-armor", amount: MODIFIER_CONFIG.ARMORED_AMOUNT });
        break;
      case "overwhelming":
        result.push({ kind: "increase-enemy-damage", amount: MODIFIER_CONFIG.OVERWHELMING_AMOUNT });
        break;
      case "sturdy":
        result.push({ kind: "labyrinth-sturdy" });
        break;
      case "burning-ground":
        result.push({ kind: "labyrinth-burning-ground" });
        break;
      case "leeching":
        result.push({ kind: "labyrinth-leeching" });
        break;
      case "null-field":
        result.push({ kind: "labyrinth-null-field" });
        break;
    }
  }
  return result;
}

// Selects enemy modifiers (non-reward) for a given node type.
// Combat gets 1, elite and boss get 2.
export function getEnemyModifiersForNodeType(
  type: "combat" | "elite" | "boss",
  rng: () => number = Math.random,
): LabyrinthModifierKind[] {
  const pool = Object.keys(ALL_LABYRINTH_MODIFIERS).filter(
    (k) => !REWARD_MODIFIER_KINDS.has(k as LabyrinthModifierKind),
  ) as LabyrinthModifierKind[];
  const count =
    type === "combat" ? MODIFIER_CONFIG.COMBAT_ENEMY_MODIFIER_COUNT : MODIFIER_CONFIG.ELITE_ENEMY_MODIFIER_COUNT;
  return shuffleWithRng(pool, rng).slice(0, Math.min(count, pool.length));
}

// Selects reward modifiers for a given node type.
// Combat: 50% chance for 1. Elite: always 1. Boss: none.
export function getRewardModifiersForNodeType(
  type: "combat" | "elite" | "boss",
  rng: () => number = Math.random,
): LabyrinthModifierKind[] {
  if (type === "boss") return [];
  if (type === "combat" && rng() < MODIFIER_CONFIG.COMBAT_REWARD_MODIFIER_CHANCE) return [];
  const pool = Array.from(REWARD_MODIFIER_KINDS);
  return [shuffleWithRng(pool, rng)[0]];
}
