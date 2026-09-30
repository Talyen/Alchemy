import { editionPolicy, resolveEdition } from "../../game-edition.mjs";
import type { GameEdition } from "../../game-edition.mjs";

declare const __ALCHEMY_EDITION__: GameEdition;
const GAME_EDITION = resolveEdition(typeof __ALCHEMY_EDITION__ === "undefined" ? "full" : __ALCHEMY_EDITION__);
export const GAME_EDITION_POLICY = editionPolicy(GAME_EDITION);
export const IS_DEMO = GAME_EDITION === "demo";
export const FULL_GAME_LOCK_MESSAGE = "Requires Full Game";
export function isEditionCharacterAvailable(id: string): boolean {
  return GAME_EDITION_POLICY.characters?.includes(id) ?? true;
}
export function isEditionModeAvailable(id: string): boolean {
  return GAME_EDITION_POLICY.modes?.includes(id) ?? true;
}
export function isEditionDifficultyAvailable(id: string): boolean {
  return GAME_EDITION_POLICY.difficulties?.includes(id) ?? true;
}
export function isEditionRunAvailable(run: {
  characterId: string;
  contentSystemType: string;
  selectedDifficulty?: string | null;
  currentAct: number;
}): boolean {
  return (
    !IS_DEMO ||
    (isEditionCharacterAvailable(run.characterId) &&
      isEditionModeAvailable(run.contentSystemType) &&
      run.selectedDifficulty === "difficulty-1" &&
      run.currentAct === 1)
  );
}
