// Pure Wildwood Draft boss bag, recovery, removal, and shared encounter trait rules.
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { characters, selectRewardCards, type BattleCard, type BestiaryEntry, type CharacterId } from "@/lib/game-data";
import { DRAFT_CHOICES } from "@/lib/game-constants";
import type { GearInstance } from "@/lib/gear";
import { shuffle } from "@/lib/utils";
import { WILDWOOD_BOSS_IDS } from "./bosses";
import {
  appendEncounterTraits,
  pickEncounterTraits,
  type EncounterCombatTraitId,
  type EncounterRewardTraitId,
} from "../encounter-traits";

export const WILDWOOD_RECOVERY_FRACTION = 0.2;
const WILDWOOD_MINIMUM_REMOVAL_DECK_SIZE = 8;

export type WildwoodModifierId = EncounterCombatTraitId;
export type WildwoodBossId = (typeof WILDWOOD_BOSS_IDS)[number];
type WildwoodDraftPhase = "draft" | "battle" | "recovery" | "reward" | "removal";

export interface WildwoodDraftState {
  version: 3;
  phase: WildwoodDraftPhase;
  draftChoices: BattleCard[];
  remainingBossIds: WildwoodBossId[];
  previousBossId: WildwoodBossId | null;
  currentBossId: WildwoodBossId | null;
  currentCombatTraitIds: EncounterCombatTraitId[];
  currentRewardTraitIds: EncounterRewardTraitId[];
  rewardType: "card" | "trinket" | "gear" | null;
  rewardChoiceIds: string[];
  rewardGearChoices: GearInstance[];
  selectedRewardId: string | null;
}

export function createWildwoodDraftChoices(
  characterId: CharacterId,
  draftedCards: BattleCard[],
  rng: () => number,
): BattleCard[] {
  return selectRewardCards(
    draftedCards,
    getOfferableCardPool(),
    DRAFT_CHOICES,
    draftedCards,
    rng,
    characters[characterId].keywords,
  );
}

export function createInitialWildwoodDraftState(characterId: CharacterId, rng: () => number): WildwoodDraftState {
  return {
    version: 3,
    phase: "draft",
    draftChoices: createWildwoodDraftChoices(characterId, [], rng),
    remainingBossIds: [],
    previousBossId: null,
    currentBossId: null,
    currentCombatTraitIds: [],
    currentRewardTraitIds: [],
    rewardType: null,
    rewardChoiceIds: [],
    rewardGearChoices: [],
    selectedRewardId: null,
  };
}

export function createWildwoodBossBag(rng: () => number): WildwoodBossId[] {
  return shuffle(WILDWOOD_BOSS_IDS, rng);
}

export function drawWildwoodBoss(
  remainingBossIds: readonly WildwoodBossId[],
  previousBossId: WildwoodBossId | null,
  rng: () => number,
): { bossId: WildwoodBossId; remainingBossIds: WildwoodBossId[] } {
  let bag = [...remainingBossIds];
  if (bag.length === 0) {
    bag = createWildwoodBossBag(rng);
    if (previousBossId && bag[0] === previousBossId && bag.length > 1) {
      const b0 = bag[0];
      const b1 = bag[1];
      if (b0 !== undefined && b1 !== undefined) {
        bag[0] = b1;
        bag[1] = b0;
      }
    }
  }
  const [firstBoss] = WILDWOOD_BOSS_IDS;
  const [bossId = firstBoss, ...rest] = bag;
  return { bossId, remainingBossIds: rest };
}

export function getWildwoodRecoveryHealth(currentHealth: number, maxHealth: number): number {
  return Math.min(maxHealth, currentHealth + Math.floor(maxHealth * WILDWOOD_RECOVERY_FRACTION));
}

export function canOfferWildwoodRemoval(deckSize: number): boolean {
  return deckSize >= WILDWOOD_MINIMUM_REMOVAL_DECK_SIZE;
}

export function pickWildwoodModifier(rng: () => number): WildwoodModifierId {
  return pickEncounterTraits("wildwood", "combat", 1, rng)[0] as EncounterCombatTraitId;
}

export function pickWildwoodRewardTrait(rng: () => number): EncounterRewardTraitId {
  return pickEncounterTraits("wildwood", "reward", 1, rng)[0] as EncounterRewardTraitId;
}

export function withWildwoodModifier(boss: BestiaryEntry, modifierId: WildwoodModifierId): BestiaryEntry {
  return appendEncounterTraits(boss, [modifierId]);
}
