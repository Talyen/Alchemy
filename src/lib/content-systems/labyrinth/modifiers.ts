import { isLootEligible } from "@/lib/loot";
import { pickRandom, shuffle } from "@/lib/rng";
import type { LabyrinthNodeType } from "../types";
import {
  ENCOUNTER_TRAITS,
  eligibleEncounterTraitIds,
  type EncounterCombatTraitId,
  type EncounterRewardTraitId,
  type EncounterTraitId,
} from "../encounter-traits";
import { LABYRINTH_TRAITS, transmutationModifierKeyword } from "./trait-catalog";
import { hasTransmutationVariant } from "@/lib/alchemist/transmutation";
import { isCompanionSummonCard, type BattleCard, type KeywordId } from "@/lib/game-data";

const INCOMPATIBLE_TRAITS: ReadonlyArray<readonly string[]> = [
  ["plated", "unbreakable", "iron-fortress"],
  ["tempered", "whitehot"],
  ["reinforced", "entrenched"],
  ["thornhide", "briar-crown", "thorns"],
  ["overgrowth", "second-wind", "regeneration"],
  ["thick-hide", "will-o-wisp", "amorphous", "dire-wolf", "ice-wraith"],
  ["ravenous", "vampire"],
  ["shielded-arrival", "starting-block"],
  ["unbinding-strike", "banshee"],
];

export function isLabyrinthTraitEligible(id: EncounterTraitId, type: LabyrinthNodeType): boolean {
  if (!ENCOUNTER_TRAITS[id].modes.includes("labyrinth")) return false;
  if (Object.hasOwn(LABYRINTH_TRAITS, id)) {
    return LABYRINTH_TRAITS[id as keyof typeof LABYRINTH_TRAITS].labyrinthNodes.includes(type);
  }
  return type === "combat" || type === "elite" || type === "boss";
}

const incompatibleByTrait = new Map<string, Set<string>>();
for (const group of INCOMPATIBLE_TRAITS) {
  for (const id of group) {
    const incompatible = incompatibleByTrait.get(id) ?? new Set<string>();
    for (const other of group) incompatible.add(other);
    incompatibleByTrait.set(id, incompatible);
  }
}

export function areLabyrinthTraitsCompatible(a: string, b: string): boolean {
  return a !== b && !incompatibleByTrait.get(a)?.has(b);
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
    if (
      enemyTraits.every((other) => areLabyrinthTraitsCompatible(id, other)) &&
      selected.every((other) => areLabyrinthTraitsCompatible(id, other))
    )
      selected.push(id);
    if (selected.length === (type === "combat" ? 1 : 2)) break;
  }
  return selected;
}

export function getRewardModifiersForNodeType(
  rng: () => number,
  type: LabyrinthNodeType = "combat",
  lootDepth = 1,
  deck?: readonly BattleCard[],
): EncounterRewardTraitId[] {
  return createRewardModifierPicker(deck)(rng, type, lootDepth);
}

/** A floor shares a deck, so compatibility and node-type pools can be reused within it. */
export function createRewardModifierPicker(deck?: readonly BattleCard[]) {
  const pools = new Map<LabyrinthNodeType, EncounterRewardTraitId[]>();
  const compatibility = new Map<KeywordId, boolean>();
  let companionPresent: boolean | undefined;
  const hasCompanion = () => (companionPresent ??= deck?.some(isCompanionSummonCard) ?? false);
  return (rng: () => number, type: LabyrinthNodeType, lootDepth: number): EncounterRewardTraitId[] => {
    let candidates = pools.get(type);
    if (!candidates) {
      candidates = eligibleEncounterTraitIds("labyrinth", "reward").filter((id) => isLabyrinthTraitEligible(id, type));
      pools.set(type, candidates);
    }
    const pool = candidates.filter((id) => {
      const keyword = transmutationModifierKeyword(id);
      let compatible = true;
      if (deck && keyword) {
        const cached = compatibility.get(keyword);
        compatible = cached ?? deck.some((card) => hasTransmutationVariant(card, keyword, hasCompanion));
        if (cached === undefined) compatibility.set(keyword, compatible);
      }
      return (
        compatible &&
        ((id !== "masterwork" && id !== "astral-hoard") || isLootEligible("astral", lootDepth)) &&
        (id !== "trinket-hoard" || isLootEligible("trinket", lootDepth)) &&
        (id !== "unique-hoard" || isLootEligible("unique", lootDepth))
      );
    });
    const selected = pickRandom(pool, rng);
    return selected ? [selected] : [];
  };
}
