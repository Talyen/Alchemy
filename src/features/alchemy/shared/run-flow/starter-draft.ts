import {
  getOfferableCardPool,
  selectRewardCards,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
} from "@/lib/game-data";
import { DRAFT_CHOICES, DRAFT_ROUNDS } from "@/lib/game-constants";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { getImmediateDamage, getImmediateDefense } from "@/lib/battle";

export function createStarterDraftChoices(draftedCards: BattleCard[], rng: () => number): BattleCard[] {
  const pool = getOfferableCardPool();
  const selected: BattleCard[] = [];
  for (const eligible of [
    pool.filter((card) => !card.consume && getImmediateDamage(card) > 0),
    pool.filter((card) => !card.consume && getImmediateDefense(card) > 0),
  ]) {
    selected.push(...selectRewardCards(draftedCards, eligible, 1, [...draftedCards, ...selected], rng));
  }
  selected.push(
    ...selectRewardCards(draftedCards, pool, DRAFT_CHOICES - selected.length, [...draftedCards, ...selected], rng),
  );
  return selected;
}

export function wildcardStarterResumeTarget(input: {
  characterId: CharacterId;
  contentSystemType: ContentSystemId;
  selectedDifficulty: DifficultyId | null;
  runDeckLength: number;
  starterDraftChoices: readonly BattleCard[] | null;
}): "draft-deck" | "difficulty-select" | null {
  if (input.characterId !== "wildcard") return null;
  if (input.contentSystemType === "wildwood") return null;
  const choices = input.starterDraftChoices;
  if (choices !== null && (input.runDeckLength >= DRAFT_ROUNDS || choices.length > 0)) return "draft-deck";
  if (
    input.contentSystemType === "campaign" &&
    input.selectedDifficulty == null &&
    input.runDeckLength >= DRAFT_ROUNDS
  ) {
    return "difficulty-select";
  }
  return null;
}
