// Difficulty definitions — stat modifiers per character per difficulty tier.
// Depends on character/enemy types. Used by run initialization to inject modifiers.
import type { CharacterId } from "./characters";
import type { EnemyStatusId } from "./types";

export type DifficultyId = "difficulty-1" | "difficulty-2" | "difficulty-3";

export type DifficultyModifier =
  | { kind: "enemy-starting-armor"; amount: number }
  | { kind: "enemy-gains-forge-each-turn" }
  | { kind: "increase-enemy-physical-damage"; amount: number }
  | { kind: "increase-enemy-damage"; amount: number }
  | { kind: "increase-enemy-status"; status: Exclude<EnemyStatusId, "stun">; amount: number }
  | { kind: "enemy-attacks-gain-leech" }
  | { kind: "start-block"; amount: number }
  | { kind: "start-max-mana"; amount: number }
  | { kind: "gold-multiplier"; amount: number }
  | { kind: "start-companion" };

export type DifficultyDefinition = {
  id: DifficultyId;
  name: string;
  description: string;
  order: number;
  modifiers: DifficultyModifier[];
};

export type ClassDifficultyConfig = {
  headerTitle: string;
  difficulties: DifficultyDefinition[];
};

export const difficultyConfigs: Record<CharacterId, ClassDifficultyConfig> = {
  knight: {
    headerTitle: "A Knight's Journey",
    difficulties: [
      { id: "difficulty-1", name: "Novice", description: "You start combat with 5 Block", order: 1, modifiers: [{ kind: "start-block", amount: 5 }] },
      { id: "difficulty-2", name: "Adventurer", description: "Enemies start combat with 2 Armor", order: 2, modifiers: [{ kind: "enemy-starting-armor", amount: 2 }] },
      { id: "difficulty-3", name: "Legend", description: "Enemies gain 1 Forge each turn", order: 3, modifiers: [{ kind: "enemy-gains-forge-each-turn" }] },
    ],
  },
  rogue: {
    headerTitle: "A Rogue's Tale",
    difficulties: [
      { id: "difficulty-1", name: "Novice", description: "You find 10% more Gold", order: 1, modifiers: [{ kind: "gold-multiplier", amount: 1.1 }] },
      { id: "difficulty-2", name: "Adventurer", description: "Enemy Poison damage is increased", order: 2, modifiers: [{ kind: "increase-enemy-status", status: "poison", amount: 2 }] },
      { id: "difficulty-3", name: "Legend", description: "Enemy Bleed damage is increased", order: 3, modifiers: [{ kind: "increase-enemy-status", status: "bleed", amount: 3 }] },
    ],
  },
  wizard: {
    headerTitle: "A Wizard's Saga",
    difficulties: [
      { id: "difficulty-1", name: "Novice", description: "You start combat with an extra Mana Crystal", order: 1, modifiers: [{ kind: "start-max-mana", amount: 1 }] },
      { id: "difficulty-2", name: "Adventurer", description: "Enemy Burn damage is increased", order: 2, modifiers: [{ kind: "increase-enemy-status", status: "burn", amount: 2 }] },
      { id: "difficulty-3", name: "Legend", description: "Enemy Freeze damage is increased", order: 3, modifiers: [{ kind: "increase-enemy-status", status: "freeze", amount: 3 }] },
    ],
  },
  ranger: {
    headerTitle: "A Ranger's Fable",
    difficulties: [
      { id: "difficulty-1", name: "Novice", description: "You start combat with a Companion", order: 1, modifiers: [{ kind: "start-companion" }] },
      { id: "difficulty-2", name: "Adventurer", description: "Enemy Nature damage is increased by 2", order: 2, modifiers: [{ kind: "increase-enemy-damage", amount: 2 }] },
      { id: "difficulty-3", name: "Legend", description: "Enemy Bleed damage is increased", order: 3, modifiers: [{ kind: "increase-enemy-status", status: "bleed", amount: 3 }] },
    ],
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ["difficulty-1", "difficulty-2", "difficulty-3"];

export function isDifficultyUnlocked(difficultyId: DifficultyId, completedDifficulties: DifficultyId[]): boolean {
  const idx = DIFFICULTY_ORDER.indexOf(difficultyId);
  if (idx === 0) return true;
  const prevDifficulty = DIFFICULTY_ORDER[idx - 1];
  return completedDifficulties.includes(prevDifficulty);
}

export function getDifficultyModifiers(characterId: CharacterId, difficultyId: DifficultyId): DifficultyModifier[] {
  const config = difficultyConfigs[characterId];
  const diff = config.difficulties.find((d) => d.id === difficultyId);
  return diff?.modifiers ?? [];
}

export function getGoldMultiplier(characterId: CharacterId, difficultyId: DifficultyId | null): number {
  if (!difficultyId) return 1;
  const modifiers = getDifficultyModifiers(characterId, difficultyId);
  const goldMod = modifiers.find((m) => m.kind === "gold-multiplier");
  return goldMod?.amount ?? 1;
}
