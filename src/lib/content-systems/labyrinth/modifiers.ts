import { isLootEligible } from "@/lib/loot";
import { pickRandom, shuffle } from "@/lib/utils";
import type { LabyrinthNodeType } from "../types";
import {
  eligibleEncounterTraitIds,
  type EncounterCombatTraitId,
  type EncounterRewardTraitId,
  type EncounterTraitId,
} from "../encounter-traits";
import { LABYRINTH_TRAITS } from "./trait-catalog";

const LEGACY_LABYRINTH_TRAITS = new Set<EncounterTraitId>([
  "septic",
  "caustic",
  "flesheater",
  "thorns",
  "insatiable",
  "jealous",
  "rooted",
  "divine-aegis",
  "wealthy",
]);

const INCOMPATIBLE_TRAITS: ReadonlyArray<readonly string[]> = [
  ["plated", "unbreakable", "iron-fortress"],
  ["tempered", "whitehot"],
  ["reinforced", "entrenched"],
  ["thornhide", "briar-crown", "thorns"],
  ["overgrowth", "second-wind", "regeneration"],
  ["thick-hide", "will-o-wisp", "amorphous", "dire-wolf", "ice-wraith"],
  ["ravenous", "vampire"],
];

export function isLabyrinthTraitEligible(id: EncounterTraitId, type: LabyrinthNodeType): boolean {
  if (LEGACY_LABYRINTH_TRAITS.has(id)) return false;
  if (Object.hasOwn(LABYRINTH_TRAITS, id)) {
    return LABYRINTH_TRAITS[id as keyof typeof LABYRINTH_TRAITS].labyrinthNodes.includes(type);
  }
  return type === "combat" || type === "elite" || type === "boss";
}

export function areLabyrinthTraitsCompatible(a: string, b: string): boolean {
  return a !== b && !INCOMPATIBLE_TRAITS.some((group) => group.includes(a) && group.includes(b));
}

export function getEnemyModifiersForNodeType(
  type: "combat" | "elite" | "boss",
  rng: () => number,
  enemyTraits: readonly string[] = [],
): EncounterCombatTraitId[] {
  const pool = shuffle(
    eligibleEncounterTraitIds("labyrinth", "combat").filter((id) => isLabyrinthTraitEligible(id, type)),
    rng,
  );
  const selected: EncounterCombatTraitId[] = [];
  for (const id of pool) {
    if ([...enemyTraits, ...selected].every((other) => areLabyrinthTraitsCompatible(id, other))) selected.push(id);
    if (selected.length === (type === "combat" ? 1 : 2)) break;
  }
  return selected;
}

export function getRewardModifiersForNodeType(
  rng: () => number,
  type: LabyrinthNodeType = "combat",
  lootDepth = 1,
): EncounterRewardTraitId[] {
  const pool = eligibleEncounterTraitIds("labyrinth", "reward").filter(
    (id) => isLabyrinthTraitEligible(id, type) && (id !== "masterwork" || isLootEligible("astral", lootDepth)),
  );
  const selected = pickRandom(pool, rng);
  return selected ? [selected] : [];
}
