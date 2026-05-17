// Labyrinth modifier definitions — enemy modifiers applied to combat and elite nodes,
// plus reward modifiers that affect gold/materials/cards/trinkets from victory.
// Encounter type determines count so players can read risk at a glance.
import type { DifficultyModifier } from "@/lib/game-data/difficulties";
import type { LabyrinthModifier, LabyrinthModifierKind } from "../types";

export const ALL_LABYRINTH_MODIFIERS: Record<LabyrinthModifierKind, LabyrinthModifier> = {
  armored: {
    kind: "armored",
    label: "Armored",
    description: "Enemies start with 2 Armor",
  },
  sturdy: {
    kind: "sturdy",
    label: "Sturdy",
    description: "Enemies have 30% more Health",
  },
  "burning-ground": {
    kind: "burning-ground",
    label: "Scorching",
    description: "Take 2 Burn damage at the end of each turn",
  },
  overwhelming: {
    kind: "overwhelming",
    label: "Overwhelming",
    description: "Enemies deal 2 more damage",
  },
  leeching: {
    kind: "leeching",
    label: "Vampiric",
    description: "Enemies heal 3 Health on their turn",
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
    description: "Victory gold is increased by 50%",
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
        result.push({ kind: "enemy-starting-armor", amount: 2 });
        break;
      case "overwhelming":
        result.push({ kind: "increase-enemy-damage", amount: 2 });
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
  const count = type === "combat" ? 1 : 2;
  return fisherYatesShuffle(pool, rng).slice(0, Math.min(count, pool.length));
}

// Selects reward modifiers for a given node type.
// Combat: 50% chance for 1. Elite: always 1. Boss: none.
export function getRewardModifiersForNodeType(
  type: "combat" | "elite" | "boss",
  rng: () => number = Math.random,
): LabyrinthModifierKind[] {
  if (type === "boss") return [];
  if (type === "combat" && rng() < 0.5) return [];
  const pool = Array.from(REWARD_MODIFIER_KINDS);
  return [fisherYatesShuffle(pool, rng)[0]];
}

// Fisher-Yates shuffle using the provided RNG for unbiased results.
function fisherYatesShuffle<T>(pool: T[], rng: () => number): T[] {
  const result = [...pool];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
