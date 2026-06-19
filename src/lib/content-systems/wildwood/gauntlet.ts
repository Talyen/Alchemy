// Pure Wildwood Draft boss bag, recovery, removal, and shared encounter trait rules.
import {
  characters,
  getOfferableCardPool,
  selectRewardCards,
  type BattleCard,
  type BestiaryEntry,
  type CharacterId,
} from "@/lib/game-data";
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

export type WildwoodDraftState = {
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
};

export function createWildwoodDraftChoices(
  characterId: CharacterId,
  draftedCards: BattleCard[],
  rng: () => number = Math.random,
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

export function createInitialWildwoodDraftState(
  characterId: CharacterId,
  rng: () => number = Math.random,
): WildwoodDraftState {
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

export function createWildwoodBossBag(rng: () => number = Math.random): WildwoodBossId[] {
  return shuffle(WILDWOOD_BOSS_IDS, rng);
}

export function drawWildwoodBoss(
  remainingBossIds: readonly WildwoodBossId[],
  previousBossId: WildwoodBossId | null,
  rng: () => number = Math.random,
): { bossId: WildwoodBossId; remainingBossIds: WildwoodBossId[] } {
  let bag = [...remainingBossIds];
  if (bag.length === 0) {
    bag = createWildwoodBossBag(rng);
    if (previousBossId && bag[0] === previousBossId && bag.length > 1) {
      [bag[0], bag[1]] = [bag[1]!, bag[0]!];
    }
  }
  const [bossId = WILDWOOD_BOSS_IDS[0]!, ...rest] = bag;
  return { bossId, remainingBossIds: rest };
}

export function getWildwoodRecoveryHealth(currentHealth: number, maxHealth: number): number {
  return Math.min(maxHealth, currentHealth + Math.floor(maxHealth * WILDWOOD_RECOVERY_FRACTION));
}

export function canOfferWildwoodRemoval(deckSize: number): boolean {
  return deckSize >= WILDWOOD_MINIMUM_REMOVAL_DECK_SIZE;
}

export function pickWildwoodModifier(rng: () => number = Math.random): WildwoodModifierId {
  return pickEncounterTraits("wildwood", "combat", 1, rng)[0] as EncounterCombatTraitId;
}

export function pickWildwoodRewardTrait(rng: () => number = Math.random): EncounterRewardTraitId {
  return pickEncounterTraits("wildwood", "reward", 1, rng)[0] as EncounterRewardTraitId;
}

export function withWildwoodModifier(boss: BestiaryEntry, modifierId: WildwoodModifierId): BestiaryEntry {
  return appendEncounterTraits(boss, [modifierId]);
}
