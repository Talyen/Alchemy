// Pure Wildwood Draft boss bag, recovery, removal, and placeholder modifier rules.
import {
  characters,
  getOfferableCardPool,
  selectRewardCards,
  type BattleCard,
  type BestiaryEntry,
  type CharacterId,
  type EnemyTrait,
} from "@/lib/game-data";
import { DRAFT_CHOICES } from "@/lib/game-constants";
import { shuffle } from "@/lib/utils";
import { WILDWOOD_BOSS_IDS } from "./bosses";

export const WILDWOOD_RECOVERY_FRACTION = 0.2;
const WILDWOOD_MINIMUM_REMOVAL_DECK_SIZE = 8;

export const WILDWOOD_MODIFIERS = [
  {
    id: "wildwood-modifier-verdant",
    title: "Verdant Wildwood Modifier",
    description: "Placeholder Wildwood modifier. No combat effect yet.",
  },
  {
    id: "wildwood-modifier-feral",
    title: "Feral Wildwood Modifier",
    description: "Placeholder Wildwood modifier. No combat effect yet.",
  },
  {
    id: "wildwood-modifier-ancient",
    title: "Ancient Wildwood Modifier",
    description: "Placeholder Wildwood modifier. No combat effect yet.",
  },
] as const satisfies readonly EnemyTrait[];

export type WildwoodModifierId = (typeof WILDWOOD_MODIFIERS)[number]["id"];
export type WildwoodBossId = (typeof WILDWOOD_BOSS_IDS)[number];
type WildwoodDraftPhase = "draft" | "battle" | "recovery" | "reward" | "removal";

export type WildwoodDraftState = {
  version: 1;
  phase: WildwoodDraftPhase;
  draftChoices: BattleCard[];
  remainingBossIds: WildwoodBossId[];
  previousBossId: WildwoodBossId | null;
  currentBossId: WildwoodBossId | null;
  currentModifierId: WildwoodModifierId | null;
  rewardType: "card" | "trinket" | null;
  rewardChoiceIds: string[];
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
    version: 1,
    phase: "draft",
    draftChoices: createWildwoodDraftChoices(characterId, [], rng),
    remainingBossIds: [],
    previousBossId: null,
    currentBossId: null,
    currentModifierId: null,
    rewardType: null,
    rewardChoiceIds: [],
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
      [bag[0], bag[1]] = [bag[1], bag[0]];
    }
  }
  const [bossId, ...rest] = bag;
  return { bossId, remainingBossIds: rest };
}

export function getWildwoodRecoveryHealth(currentHealth: number, maxHealth: number): number {
  return Math.min(maxHealth, currentHealth + Math.floor(maxHealth * WILDWOOD_RECOVERY_FRACTION));
}

export function canOfferWildwoodRemoval(deckSize: number): boolean {
  return deckSize >= WILDWOOD_MINIMUM_REMOVAL_DECK_SIZE;
}

function getWildwoodModifier(id: WildwoodModifierId): EnemyTrait {
  return WILDWOOD_MODIFIERS.find((modifier) => modifier.id === id) ?? WILDWOOD_MODIFIERS[0];
}

export function pickWildwoodModifier(rng: () => number = Math.random): WildwoodModifierId {
  return WILDWOOD_MODIFIERS[Math.floor(rng() * WILDWOOD_MODIFIERS.length)].id;
}

export function withWildwoodModifier(boss: BestiaryEntry, modifierId: WildwoodModifierId): BestiaryEntry {
  return { ...boss, traits: [...boss.traits, getWildwoodModifier(modifierId)] };
}
