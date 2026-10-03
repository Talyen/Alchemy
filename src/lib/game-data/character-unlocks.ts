import { characters, type CharacterId } from "./characters";

const CHARACTER_REQUIREMENTS: Record<CharacterId, CharacterId | null> = {
  knight: null,
  rogue: "knight",
  ranger: "rogue",
  wizard: "ranger",
  alchemist: "wizard",
  warlock: "alchemist",
  druid: "warlock",
  wildcard: "druid",
};

export type ProgressionFeatureId = "talents" | "homestead";
export type GameModeId = "campaign" | "labyrinth" | "wildwood";

const FEATURE_REQUIREMENTS: Record<ProgressionFeatureId, CharacterId> = {
  talents: "knight",
  homestead: "knight",
};

const GAME_MODE_REQUIREMENTS: Record<GameModeId, CharacterId | null> = {
  campaign: null,
  labyrinth: "rogue",
  wildwood: "ranger",
};

function getUnlockMessage(requiredCharacterId: CharacterId): string {
  return `Finish a Run as the ${characters[requiredCharacterId].name} to unlock`;
}

export const KNIGHT_UNLOCK_MESSAGE = getUnlockMessage("knight");

export function getRequiredPreviousCharacter(characterId: CharacterId): CharacterId | null {
  return CHARACTER_REQUIREMENTS[characterId];
}

export function isCharacterUnlocked(characterId: CharacterId, finishedRunCharacters: readonly CharacterId[]): boolean {
  const required = getRequiredPreviousCharacter(characterId);
  return required === null || finishedRunCharacters.includes(required);
}

export function getCharacterUnlockMessage(characterId: CharacterId): string {
  const required = getRequiredPreviousCharacter(characterId);
  return required ? getUnlockMessage(required) : "";
}

export function isProgressionFeatureUnlocked(
  featureId: ProgressionFeatureId,
  finishedRunCharacters: readonly CharacterId[],
): boolean {
  return finishedRunCharacters.includes(FEATURE_REQUIREMENTS[featureId]);
}

export function getProgressionFeatureUnlockMessage(featureId: ProgressionFeatureId): string {
  return getUnlockMessage(FEATURE_REQUIREMENTS[featureId]);
}

export function isGameModeUnlocked(modeId: GameModeId, finishedRunCharacters: readonly CharacterId[]): boolean {
  const required = GAME_MODE_REQUIREMENTS[modeId];
  return required === null || finishedRunCharacters.includes(required);
}

export function getGameModeUnlockMessage(modeId: GameModeId): string {
  const required = GAME_MODE_REQUIREMENTS[modeId];
  return required ? getUnlockMessage(required) : "";
}
