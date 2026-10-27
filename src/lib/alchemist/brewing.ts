import { cloneBattleCard, getStandardPotionPool, isPotionCard, type BattleCard } from "@/lib/game-data";
import { CAMPFIRE_POTION_OFFERS } from "@/lib/game-constants";
import { shuffle } from "@/lib/rng";
import { doublePotionPotency } from ".";
import type { EncounterRewardTraitId } from "../content-systems/encounter-traits";

export { strengthenPotion } from "./potion-scaling";

export type BrewOperation =
  | { kind: "new"; offerIndex: number }
  | { kind: "combine"; indices: [number, number] }
  | { kind: "strengthen"; index: number };
export function getCampfireBrewKind(deck: readonly BattleCard[]): "new" | "combine" {
  let potions = 0;
  for (const card of deck) if (isPotionCard(card) && ++potions === 2) return "combine";
  return "new";
}

const DEFENSIVE_POTION_IDS: ReadonlySet<string> = new Set(["health-potion", "stoneskin-potion", "panacea-potion"]);

export function createCampfirePotionOffers(rng: () => number): BattleCard[] {
  const pool = shuffle(getStandardPotionPool(), rng);
  const defensiveIndex = pool.findIndex((card) => DEFENSIVE_POTION_IDS.has(card.id));
  const ordered =
    defensiveIndex < 0
      ? pool
      : [pool[defensiveIndex]!, ...pool.slice(0, defensiveIndex), ...pool.slice(defensiveIndex + 1)];
  return ordered.slice(0, CAMPFIRE_POTION_OFFERS).map(cloneBattleCard);
}

export function applyStrongSpiritsToPotions(
  potions: BattleCard[],
  modifiers: readonly EncounterRewardTraitId[] = [],
): BattleCard[] {
  return modifiers.includes("strong-spirits") ? potions.map(doublePotionPotency) : potions;
}

/** Initial visits and save repair use the same shelf recipe and modifier order. */
export function createAlchemistBrewOffers(
  rng: () => number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): BattleCard[] {
  return applyStrongSpiritsToPotions(createCampfirePotionOffers(rng), modifiers);
}
