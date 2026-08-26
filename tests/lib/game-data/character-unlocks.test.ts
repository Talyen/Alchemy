import { describe, expect, it } from "vitest";
import {
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

describe("character unlock policy", () => {
  it.each<{
    character: CharacterId;
    finished: CharacterId[];
    unlocked: boolean;
    message: string;
  }>([
    { character: "knight", finished: [], unlocked: true, message: "" },
    { character: "rogue", finished: [], unlocked: false, message: "Finish a Run as the Knight to unlock" },
    {
      character: "wizard",
      finished: ["knight", "rogue"],
      unlocked: true,
      message: "Finish a Run as the Rogue to unlock",
    },
    {
      character: "ranger",
      finished: [],
      unlocked: false,
      message: "Finish a Run as the Wizard to unlock",
    },
    {
      character: "alchemist",
      finished: ["ranger"],
      unlocked: true,
      message: "Finish a Run as the Ranger to unlock",
    },
    {
      character: "warlock",
      finished: [],
      unlocked: false,
      message: "Finish a Run as the Alchemist to unlock",
    },
    {
      character: "druid",
      finished: ["warlock"],
      unlocked: true,
      message: "Finish a Run as the Warlock to unlock",
    },
    {
      character: "wildcard",
      finished: ["druid"],
      unlocked: true,
      message: "Finish a Run as the Druid to unlock",
    },
  ])("resolves $character", ({ character, finished, unlocked, message }) => {
    expect(isCharacterUnlocked(character, finished)).toBe(unlocked);
    expect(getCharacterUnlockMessage(character)).toBe(message);
  });
});

describe("feature unlock policy", () => {
  it.each([
    ["talents", [] as CharacterId[], false],
    ["talents", ["knight"] as CharacterId[], true],
    ["homestead", [] as CharacterId[], false],
    ["homestead", ["knight"] as CharacterId[], true],
  ] as const)("resolves %s from completed characters", (feature, finished, unlocked) => {
    expect(isProgressionFeatureUnlocked(feature, finished)).toBe(unlocked);
  });

  it("returns unlock message for progression features", () => {
    expect(getProgressionFeatureUnlockMessage("talents")).toBe("Finish a Run as the Knight to unlock");
    expect(getProgressionFeatureUnlockMessage("homestead")).toBe("Finish a Run as the Knight to unlock");
    expect(KNIGHT_UNLOCK_MESSAGE).toBe("Finish a Run as the Knight to unlock");
  });

  it.each<{
    mode: GameModeId;
    finished: CharacterId[];
    unlocked: boolean;
    message: string;
  }>([
    { mode: "campaign", finished: [], unlocked: true, message: "" },
    { mode: "labyrinth", finished: [], unlocked: false, message: "Finish a Run as the Rogue to unlock" },
    {
      mode: "labyrinth",
      finished: ["rogue"],
      unlocked: true,
      message: "Finish a Run as the Rogue to unlock",
    },
    { mode: "wildwood", finished: [], unlocked: false, message: "Finish a Run as the Ranger to unlock" },
    {
      mode: "wildwood",
      finished: ["ranger"],
      unlocked: true,
      message: "Finish a Run as the Ranger to unlock",
    },
  ])("resolves $mode", ({ mode, finished, unlocked, message }) => {
    expect(isGameModeUnlocked(mode, finished)).toBe(unlocked);
    expect(getGameModeUnlockMessage(mode)).toBe(message);
  });
});
