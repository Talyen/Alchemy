// Shared encounter trait catalog and mode-aware deterministic selection helpers.
import type { EnemyTrait } from "@/lib/game-data";
import { shuffle } from "@/lib/utils";
import type { ContentSystemId } from "./types";

export const COMBAT_ENCOUNTER_TRAIT_IDS = [
  "tempered",
  "plated",
  "reinforced",
  "braced",
  "septic",
  "caustic",
  "flesheater",
  "combustible",
  "chilling",
  "thorns",
  "zealot",
  "insatiable",
  "jealous",
  "concussive",
  "rooted",
  "overgrowth",
  "holy-retribution",
  "divine-aegis",
] as const;

export const REWARD_ENCOUNTER_TRAIT_IDS = ["collector", "generous", "alchemist", "scavenger", "companion"] as const;

/** Retained as save-migration tombstones when encounter traits leave the catalog. */
const RETIRED_ENCOUNTER_TRAIT_IDS = [
  "armored",
  "sturdy",
  "burning-ground",
  "overwhelming",
  "leeching",
  "null-field",
] as const;

export type EncounterCombatTraitId = (typeof COMBAT_ENCOUNTER_TRAIT_IDS)[number];
export type EncounterRewardTraitId = (typeof REWARD_ENCOUNTER_TRAIT_IDS)[number];
export type EncounterTraitId = EncounterCombatTraitId | EncounterRewardTraitId;
export type EncounterTraitCategory = "combat" | "reward";
type EncounterMode = Extract<ContentSystemId, "labyrinth" | "wildwood">;

export type EncounterTraitDefinition = {
  id: EncounterTraitId;
  category: EncounterTraitCategory;
  label: string;
  description: string;
  modes: readonly EncounterMode[];
  enemyTrait: EnemyTrait;
};

function combat(id: EncounterCombatTraitId, label: string, description: string): EncounterTraitDefinition {
  return {
    id,
    category: "combat",
    label,
    description,
    modes: ["labyrinth", "wildwood"],
    enemyTrait: { id, title: label, description },
  };
}

function reward(
  id: EncounterRewardTraitId,
  label: string,
  description: string,
  modes: readonly EncounterMode[],
): EncounterTraitDefinition {
  return { id, category: "reward", label, description, modes, enemyTrait: { id, title: label, description } };
}

export const ENCOUNTER_TRAITS: Record<EncounterTraitId, EncounterTraitDefinition> = {
  tempered: combat("tempered", "Tempered", "Gains 1 Forge each turn"),
  plated: combat("plated", "Plated", "Gains 1 Armor each turn"),
  reinforced: combat("reinforced", "Reinforced", "Gains 2 Block each turn"),
  braced: combat("braced", "Braced", "Receives half Stun build-up"),
  septic: combat("septic", "Septic", "Deals 1 Poison or Bleed damage each turn"),
  caustic: combat("caustic", "Caustic", "Deals 1 Poison damage and strips 1 Armor each turn"),
  flesheater: combat("flesheater", "Flesheater", "Deals 1 Bleed damage each turn\nLeech"),
  combustible: combat("combustible", "Combustible", "Deals 1 Burn damage each turn"),
  chilling: combat("chilling", "Chilling", "Deals 1 Freeze damage each turn"),
  thorns: combat("thorns", "Thorns", "Deals 1 Physical damage when attacked"),
  zealot: combat("zealot", "Zealot", "Deals 2 Holy damage each turn"),
  insatiable: combat("insatiable", "Insatiable", "Gains 1 Physical damage each time you Consume a card"),
  jealous: combat("jealous", "Jealous", "Gains 1 Physical damage each time you Wish"),
  concussive: combat("concussive", "Concussive", "Deals 1 Stun damage each turn"),
  rooted: combat("rooted", "Rooted", "Gains 1 Block when you play a Nature card"),
  overgrowth: combat("overgrowth", "Overgrowth", "Regenerates 1 Health each turn"),
  "holy-retribution": combat("holy-retribution", "Holy Retribution", "Deals 1 Holy damage when attacked"),
  "divine-aegis": combat(
    "divine-aegis",
    "Divine Aegis",
    "Gains 2 Armor and 4 Block the first time reaching 50% Health",
  ),
  collector: reward("collector", "Collector", "Guaranteed trinket reward from this encounter", [
    "labyrinth",
    "wildwood",
  ]),
  generous: reward("generous", "Generous", "Victory gold is increased by 50%", ["labyrinth"]),
  alchemist: reward("alchemist", "Alchemist", "Gain a random potion alongside the normal reward", [
    "labyrinth",
    "wildwood",
  ]),
  scavenger: reward("scavenger", "Scavenger", "Material loot from this encounter is doubled", ["labyrinth"]),
  companion: reward("companion", "Companion", "Choose a free Companion card after the battle", [
    "labyrinth",
    "wildwood",
  ]),
};

function isEncounterTraitId(value: string): value is EncounterTraitId {
  return value in ENCOUNTER_TRAITS;
}

export function sanitizeEncounterTraitIds(values: readonly string[], category: "combat"): EncounterCombatTraitId[];
export function sanitizeEncounterTraitIds(values: readonly string[], category: "reward"): EncounterRewardTraitId[];
export function sanitizeEncounterTraitIds(
  values: readonly string[],
  category: EncounterTraitCategory,
): EncounterTraitId[] {
  return [...new Set(values)].filter(
    (value): value is EncounterTraitId => isEncounterTraitId(value) && ENCOUNTER_TRAITS[value].category === category,
  );
}

export function pickEncounterTraits(
  mode: EncounterMode,
  category: EncounterTraitCategory,
  count: number,
  rng: () => number = Math.random,
): EncounterTraitId[] {
  const pool = Object.values(ENCOUNTER_TRAITS)
    .filter((trait) => trait.category === category && trait.modes.includes(mode))
    .map((trait) => trait.id);
  return shuffle(pool, rng).slice(0, Math.min(count, pool.length));
}

export function appendEncounterTraits<T extends { traits: EnemyTrait[] }>(
  enemy: T,
  ids: readonly EncounterCombatTraitId[],
): T {
  return { ...enemy, traits: [...enemy.traits, ...ids.map((id) => ENCOUNTER_TRAITS[id].enemyTrait)] };
}

export function sanitizePersistedEnemyTraits(traits: readonly EnemyTrait[]): EnemyTrait[] {
  const retired = new Set<string>(RETIRED_ENCOUNTER_TRAIT_IDS);
  return traits.filter((trait) => !retired.has(trait.id));
}
