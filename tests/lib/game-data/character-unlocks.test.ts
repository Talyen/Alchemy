import { describe, expect, it } from "vitest";
import {
  characters,
  getCharacterUnlockMessage,
  getGameModeUnlockMessage,
  getProgressionFeatureUnlockMessage,
  isCharacterUnlocked,
  isGameModeUnlocked,
  isProgressionFeatureUnlocked,
  KNIGHT_UNLOCK_MESSAGE,
  type CharacterId,
  type GameModeId,
} from "@/lib/game-data";

describe("progression unlock policy", () => {
  it("requires completion of the immediate predecessor, allowing progress without every earlier completion", () => {
    const chain: CharacterId[] = ["knight", "rogue", "ranger", "wizard", "alchemist", "warlock", "druid", "wildcard"];
    expect(isCharacterUnlocked("knight", [])).toBe(true);
    expect(getCharacterUnlockMessage("knight")).toBe("");
    for (let index = 1; index < chain.length; index++) {
      const character = chain[index]!;
      const previous = chain[index - 1]!;
      expect(isCharacterUnlocked(character, []), character).toBe(false);
      expect(isCharacterUnlocked(character, [previous]), character).toBe(true);
      expect(
        isCharacterUnlocked(
          character,
          chain.filter((id) => id !== previous),
        ),
        character,
      ).toBe(false);
      expect(getCharacterUnlockMessage(character)).toBe(`Finish a Run as the ${characters[previous].name} to unlock`);
    }
  });

  it("opens Talents and the Homestead only after a Knight run", () => {
    for (const feature of ["talents", "homestead"] as const) {
      expect(isProgressionFeatureUnlocked(feature, [])).toBe(false);
      expect(isProgressionFeatureUnlocked(feature, ["rogue"])).toBe(false);
      expect(isProgressionFeatureUnlocked(feature, ["knight"])).toBe(true);
      expect(getProgressionFeatureUnlockMessage(feature)).toBe(KNIGHT_UNLOCK_MESSAGE);
    }
    expect(KNIGHT_UNLOCK_MESSAGE).toBe("Finish a Run as the Knight to unlock");
  });

  it.each<{ mode: GameModeId; required: CharacterId | null }>([
    { mode: "campaign", required: null },
    { mode: "labyrinth", required: "rogue" },
    { mode: "wildwood", required: "ranger" },
  ])("gates $mode using its own completion requirement", ({ mode, required }) => {
    expect(isGameModeUnlocked(mode, [])).toBe(required === null);
    if (required) {
      expect(isGameModeUnlocked(mode, ["knight"])).toBe(false);
      expect(isGameModeUnlocked(mode, [required])).toBe(true);
    }
    expect(getGameModeUnlockMessage(mode)).toBe(
      required ? `Finish a Run as the ${characters[required].name} to unlock` : "",
    );
  });
});
