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

export const KNIGHT_UNLOCK_MESSAGE = "Finish a Run as the Knight to unlock";

export const characterUnlockRequirements: Record<
  CharacterId,
  { requiredChar: CharacterId | null; requiredName: string }
> = Object.fromEntries(
  UNLOCK_CHAIN.map((id, index) => {
    const requiredChar = index === 0 ? null : UNLOCK_CHAIN[index - 1]!;
    return [id, { requiredChar, requiredName: requiredChar ? characters[requiredChar].name : "" }];
  }),
) as Record<CharacterId, { requiredChar: CharacterId | null; requiredName: string }>;

export function getRequiredPreviousCharacter(characterId: CharacterId): CharacterId | null {
  return characterUnlockRequirements[characterId].requiredChar;
}

export function isCharacterUnlocked(characterId: CharacterId, finishedRunCharacters: CharacterId[]): boolean {
  const required = getRequiredPreviousCharacter(characterId);
  return required === null || finishedRunCharacters.includes(required);
}
