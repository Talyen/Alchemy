import type { CharacterId } from "./characters";
import type { CompanionId, EnemyStatusId } from "./types";

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
  | { kind: "start-companion"; companionId?: CompanionId }
  | { kind: "enemy-health-multiplier"; amount: number }
  | { kind: "enemy-damage-multiplier"; amount: number };

interface DifficultyDefinition {
  id: DifficultyId;
  name: string;
  description: string;
  order: number;
  modifiers: DifficultyModifier[];
  xpMultiplier?: number;
}

export interface ClassDifficultyConfig {
  headerTitle: string;
  difficulties: DifficultyDefinition[];
}

const GLOBAL_DIFFICULTIES: DifficultyDefinition[] = [
  {
    id: "difficulty-1",
    name: "Novice",
    description: "No Modifiers",
    order: 1,
    modifiers: [],
  },
  {
    id: "difficulty-2",
    name: "Adventurer",
    description: "+30% Enemy Health and Damage",
    order: 2,
    xpMultiplier: 1.3,
    modifiers: [
      { kind: "enemy-health-multiplier", amount: 1.3 },
      { kind: "enemy-damage-multiplier", amount: 1.3 },
    ],
  },
  {
    id: "difficulty-3",
    name: "Legend",
    description: "+180% Enemy Health, +60% Enemy Damage",
    order: 3,
    xpMultiplier: 1.6,
    modifiers: [
      { kind: "enemy-health-multiplier", amount: 2.8 },
      { kind: "enemy-damage-multiplier", amount: 1.6 },
    ],
  },
];

const CHARACTER_HEADER_TITLES = {
  knight: "A Knight's Journey",
  rogue: "A Rogue's Tale",
  wizard: "A Wizard's Saga",
  ranger: "A Ranger's Fable",
  alchemist: "An Alchemist's Journey",
  warlock: "A Warlock's Journey",
  druid: "A Druid's Journey",
  wildcard: "A Wildcard's Journey",
} satisfies Record<CharacterId, string>;

export const difficultyConfigs: Record<CharacterId, ClassDifficultyConfig> = Object.fromEntries(
  (Object.keys(CHARACTER_HEADER_TITLES) as CharacterId[]).map((id) => [
    id,
    { headerTitle: CHARACTER_HEADER_TITLES[id], difficulties: GLOBAL_DIFFICULTIES },
  ]),
) as Record<CharacterId, ClassDifficultyConfig>;

export const DIFFICULTY_ORDER: DifficultyId[] = ["difficulty-1", "difficulty-2", "difficulty-3"];

export function isDifficultyUnlocked(difficultyId: DifficultyId, completedDifficulties: DifficultyId[]): boolean {
  const idx = DIFFICULTY_ORDER.indexOf(difficultyId);
  if (idx === 0) return true;
  const prevDifficulty = DIFFICULTY_ORDER[idx - 1]!;
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

const XP_MULTIPLIERS = new Map(GLOBAL_DIFFICULTIES.map((d) => [d.id, d.xpMultiplier ?? 1] as const));

export function getDifficultyXPMultiplier(difficultyId: DifficultyId | null): number {
  if (!difficultyId) return 1.0;
  return XP_MULTIPLIERS.get(difficultyId) ?? 1.0;
}
