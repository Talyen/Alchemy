// Labyrinth modifier definitions — six modifiers applied to combat/elite nodes.
// Depth determines count: rows 0-1 → 0-1, rows 2-3 → 1, row 4 → 1-2.
import type { DifficultyModifier } from "@/lib/game-data/difficulties";
import type { LabyrinthModifier, LabyrinthModifierKind } from "../types";

export const ALL_LABYRINTH_MODIFIERS: Record<LabyrinthModifierKind, LabyrinthModifier> = {
  "armored": {
    kind: "armored",
    label: "Armored",
    description: "Enemies start with 2 Armor",
  },
  "sturdy": {
    kind: "sturdy",
    label: "Sturdy",
    description: "Enemies have 30% more Health",
  },
  "burning-ground": {
    kind: "burning-ground",
    label: "Burning Ground",
    description: "Take 2 Burn damage at the end of each turn",
  },
  "overwhelming": {
    kind: "overwhelming",
    label: "Overwhelming",
    description: "Enemies deal 2 more damage",
  },
  "leeching": {
    kind: "leeching",
    label: "Leeching",
    description: "Enemies heal 3 Health on their turn",
  },
  "null-field": {
    kind: "null-field",
    label: "Null Field",
    description: "Status effects are applied at half value",
  },
};

// Converts Labyrinth modifier kind strings into DifficultyModifier objects
// consumed by the battle engine. Reuses campaign modifier kinds where applicable.
export function labyrinthModifiersToDifficulty(modifiers: string[]): DifficultyModifier[] {
  const result: DifficultyModifier[] = [];
  for (const m of modifiers) {
    switch (m) {
      case "armored":       result.push({ kind: "enemy-starting-armor", amount: 2 }); break;
      case "overwhelming":  result.push({ kind: "increase-enemy-damage", amount: 2 }); break;
      case "sturdy":        result.push({ kind: "labyrinth-sturdy" }); break;
      case "burning-ground": result.push({ kind: "labyrinth-burning-ground" }); break;
      case "leeching":      result.push({ kind: "labyrinth-leeching" }); break;
      case "null-field":    result.push({ kind: "labyrinth-null-field" }); break;
    }
  }
  return result;
}

export function getModifiersForRow(row: number, rng: () => number = Math.random): LabyrinthModifierKind[] {
  const pool = Object.keys(ALL_LABYRINTH_MODIFIERS) as LabyrinthModifierKind[];
  const count = row <= 1 ? rollModifierCount(0, 1, rng) : row === 4 ? rollModifierCount(1, 2, rng) : rollModifierCount(1, 1, rng);
  return fisherYatesShuffle(pool, rng).slice(0, Math.min(count, pool.length));
}

function rollModifierCount(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
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
