import { characters, type CharacterId } from "./characters";

const UNLOCK_CHAIN: CharacterId[] = [
  "knight",
  "rogue",
  "wizard",
  "ranger",
  "alchemist",
  "warlock",
  "druid",
  "wildcard",
];

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

const characterUnlockRequirements: Record<CharacterId, { requiredChar: CharacterId | null; requiredName: string }> =
  Object.fromEntries(
    UNLOCK_CHAIN.map((id, index) => {
      const requiredChar = index === 0 ? null : UNLOCK_CHAIN[index - 1]!;
      return [id, { requiredChar, requiredName: requiredChar ? characters[requiredChar].name : "" }];
    }),
  ) as Record<CharacterId, { requiredChar: CharacterId | null; requiredName: string }>;

export function getRequiredPreviousCharacter(characterId: CharacterId): CharacterId | null {
  return characterUnlockRequirements[characterId].requiredChar;
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

function getGameModeUnlockRequirement(modeId: GameModeId): CharacterId | null {
  return GAME_MODE_REQUIREMENTS[modeId];
}

export function isGameModeUnlocked(modeId: GameModeId, finishedRunCharacters: readonly CharacterId[]): boolean {
  const required = getGameModeUnlockRequirement(modeId);
  return required === null || finishedRunCharacters.includes(required);
}

export function getGameModeUnlockMessage(modeId: GameModeId): string {
  const required = getGameModeUnlockRequirement(modeId);
  return required ? getUnlockMessage(required) : "";
}
