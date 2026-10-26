import type { BattleCard, CharacterId, DifficultyId } from "@/lib/game-data";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import type { ContentSystemId } from "@/lib/content-systems/types";

export { createStarterDraftChoices } from "@/lib/starter-draft";

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
