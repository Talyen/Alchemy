import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { characters, selectRewardCards, type BattleCard, type BestiaryEntry, type CharacterId } from "@/lib/game-data";
import { DRAFT_CHOICES, DRAFT_ROUNDS } from "@/lib/game-constants";
import { isValidDeckIndex, shuffle } from "@/lib/utils";
import { WILDWOOD_BOSS_IDS, type WildwoodBossId } from "./bosses";
import {
  appendEncounterTraits,
  pickEncounterTrait,
  type EncounterCombatTraitId,
  type EncounterRewardTraitId,
} from "../encounter-traits";

const WILDWOOD_MINIMUM_REMOVAL_DECK_SIZE = 8;

export type WildwoodModifierId = EncounterCombatTraitId;
export type { WildwoodBossId } from "./bosses";
type WildwoodDraftPhase = "draft" | "battle" | "reward" | "removal";

export interface WildwoodDraftState {
  phase: WildwoodDraftPhase;
  draftChoices: BattleCard[];
  remainingBossIds: WildwoodBossId[];
  previousBossId: WildwoodBossId | null;
  currentBossId: WildwoodBossId | null;
  currentCombatTraitIds: EncounterCombatTraitId[];
  currentRewardTraitIds: EncounterRewardTraitId[];
}

function createWildwoodDraftChoices(
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
    phase: "draft",
    draftChoices: createWildwoodDraftChoices(characterId, [], rng),
    remainingBossIds: [],
    previousBossId: null,
    currentBossId: null,
    currentCombatTraitIds: [],
    currentRewardTraitIds: [],
  };
}

export function offeredWildwoodDraftCard(
  state: WildwoodDraftState,
  runDeck: readonly BattleCard[],
  requestedCardId: string,
): BattleCard | null {
  if (state.phase !== "draft" || runDeck.length >= DRAFT_ROUNDS) return null;
  return state.draftChoices.find((choice) => choice.id === requestedCardId) ?? null;
}

export function pickWildwoodDraftCard(
  state: WildwoodDraftState,
  characterId: CharacterId,
  runDeck: readonly BattleCard[],
  requestedCardId: string,
  rng: () => number,
): { card: BattleCard; state: WildwoodDraftState } | null {
  const card = offeredWildwoodDraftCard(state, runDeck, requestedCardId);
  if (!card) return null;
  const nextDeck = [...runDeck, card];
  return {
    card,
    state: {
      ...state,
      draftChoices: nextDeck.length >= DRAFT_ROUNDS ? [] : createWildwoodDraftChoices(characterId, nextDeck, rng),
    },
  };
}

export function canCompleteWildwoodDraft(state: WildwoodDraftState, deckSize: number): boolean {
  return state.phase === "draft" && deckSize >= DRAFT_ROUNDS;
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
  const [bossId, ...rest] = bag;
  if (!bossId) throw new Error("Wildwood requires at least one boss in the compendium");
  return { bossId, remainingBossIds: rest };
}

export function canPrepareNextWildwoodBoss(state: WildwoodDraftState, deckSize: number): boolean {
  return (
    state.phase === "reward" ||
    state.phase === "removal" ||
    (state.phase === "draft" && canCompleteWildwoodDraft(state, deckSize))
  );
}

export function prepareNextWildwoodBoss(
  state: WildwoodDraftState,
  deckSize: number,
  rng: () => number,
): { state: WildwoodDraftState; bossId: WildwoodBossId; modifierId: WildwoodModifierId } | null {
  if (!canPrepareNextWildwoodBoss(state, deckSize)) return null;
  const draw = drawWildwoodBoss(state.remainingBossIds, state.currentBossId ?? state.previousBossId, rng);
  const modifierId = pickWildwoodModifier(rng);
  const rewardTraitId = pickWildwoodRewardTrait(rng);
  return {
    bossId: draw.bossId,
    modifierId,
    state: {
      ...state,
      remainingBossIds: draw.remainingBossIds,
      previousBossId: state.currentBossId ?? state.previousBossId,
      currentBossId: draw.bossId,
      currentCombatTraitIds: [modifierId],
      currentRewardTraitIds: [rewardTraitId],
    },
  };
}

export function enterWildwoodBattle(state: WildwoodDraftState): WildwoodDraftState | null {
  if (state.phase === "battle" || !state.currentBossId || state.currentCombatTraitIds.length === 0) return null;
  return { ...state, phase: "battle" };
}

export function canOfferWildwoodRemoval(deckSize: number): boolean {
  return deckSize >= WILDWOOD_MINIMUM_REMOVAL_DECK_SIZE;
}

export function enterWildwoodRemoval(state: WildwoodDraftState): WildwoodDraftState | null {
  return state.phase === "reward" ? { ...state, phase: "removal" } : null;
}

export function removeWildwoodCard(
  state: WildwoodDraftState,
  runDeck: readonly BattleCard[],
  index: number,
): BattleCard[] | null {
  if (state.phase !== "removal" || !canOfferWildwoodRemoval(runDeck.length) || !isValidDeckIndex(index, runDeck.length))
    return null;
  return runDeck.filter((_, cardIndex) => cardIndex !== index);
}

export function canSkipWildwoodRemoval(state: WildwoodDraftState): boolean {
  return state.phase === "removal";
}

export function enterWildwoodReward(state: WildwoodDraftState): WildwoodDraftState | null {
  return state.phase === "battle" ? { ...state, phase: "reward", currentCombatTraitIds: [] } : null;
}

function pickWildwoodModifier(rng: () => number): WildwoodModifierId {
  return pickEncounterTrait("wildwood", "combat", rng);
}

function pickWildwoodRewardTrait(rng: () => number): EncounterRewardTraitId {
  return pickEncounterTrait("wildwood", "reward", rng);
}

export function withWildwoodModifier(boss: BestiaryEntry, modifierId: WildwoodModifierId): BestiaryEntry {
  return appendEncounterTraits(boss, [modifierId]);
}
