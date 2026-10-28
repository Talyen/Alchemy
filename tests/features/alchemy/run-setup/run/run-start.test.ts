import { makeTestCard } from "../../../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { getStartingDeck } from "@/lib/game-data";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { createRunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { createInitialActiveRunFields } from "@/features/alchemy/shared/stores/session/run-state-init";
import {
  canReplaceRunForStart,
  isDifficultySelectContinuation,
} from "@/features/alchemy/run-setup/run/run-start-command";

describe("createRunStartSnapshot", () => {
  it("keeps freshly initialized decks independent of other runs and the catalog", () => {
    const original = getStartingDeck("knight");
    const first = createInitialActiveRunFields(null, "knight").runDeck;
    const second = createInitialActiveRunFields(null, "knight").runDeck;
    first[0]!.cost += 10;
    first[0]!.descriptionLines.push("Changed in this run");
    const damage = first.flatMap((card) => card.effects).find((effect) => effect.kind === "damage");
    expect(damage).toBeDefined();
    damage!.amount += 100;
    expect(second).toEqual(original);
    expect(getStartingDeck("knight")).toEqual(original);
  });

  it.each(["campaign", "labyrinth", "wildwood"] as const)(
    "starts %s with an independent deck, and its supported difficulty",
    (contentSystemType) => {
      const result = createRunStartSnapshot({
        characterId: "knight",
        contentSystemType,
        difficultyId: "difficulty-2",
        talentXP: {},
      });
      expect(result).toMatchObject({
        characterId: "knight",
        contentSystemType,
        selectedDifficulty: contentSystemType === "campaign" ? "difficulty-2" : null,
        runPlayerHealth: MAX_PLAYER_HEALTH,
        runMaxHealth: MAX_PLAYER_HEALTH,
      });
      expect(result.runDeck).toEqual(getStartingDeck("knight"));
    },
  );

  it("uses draftedDeck for wildcard campaign snapshot", () => {
    const draftedCards = [makeTestCard({ id: "slash" }), makeTestCard({ id: "block" })];
    const result = createRunStartSnapshot({
      characterId: "wildcard",
      contentSystemType: "campaign",
      difficultyId: "difficulty-1",
      talentXP: {},
      draftedDeck: draftedCards,
    });

    expect(result.characterId).toBe("wildcard");
    expect(result.runDeck).toEqual(draftedCards);
    expect(result.runDeck).not.toEqual(getStartingDeck("wildcard"));
    expect(result.contentSystemType).toBe("campaign");
    expect(result.selectedDifficulty).toBe("difficulty-1");
  });

  it("scales max health from permanent talent XP at run start", () => {
    const result = createRunStartSnapshot({
      characterId: "knight",
      contentSystemType: "campaign",
      difficultyId: "difficulty-1",
      talentXP: { physical: 20, health: 60 },
    });

    expect(result.runMaxHealth).toBe(MAX_PLAYER_HEALTH + 3);
    expect(result.runPlayerHealth).toBe(MAX_PLAYER_HEALTH + 3);
  });

  it("adds gear max-health bonus to run cap at run start", () => {
    const result = createRunStartSnapshot({
      characterId: "knight",
      contentSystemType: "campaign",
      talentXP: {},
      gearMaxHealthBonus: 4,
    });

    expect(result.runMaxHealth).toBe(MAX_PLAYER_HEALTH + 4);
    expect(result.runPlayerHealth).toBe(MAX_PLAYER_HEALTH + 4);
  });

  it("falls back to character starting deck when no draftedDeck provided for wildcard", () => {
    const result = createRunStartSnapshot({
      characterId: "wildcard",
      contentSystemType: "campaign",
      difficultyId: "difficulty-1",
      talentXP: {},
    });

    expect(result.runDeck).toEqual(getStartingDeck("wildcard"));
    expect(result.runDeck).toEqual([]);
  });
});

describe("canReplaceRunForStart", () => {
  const wildcard = { characterId: "wildcard", contentSystemType: "campaign" } as const;
  const knight = { characterId: "knight", contentSystemType: "campaign" } as const;
  it.each([
    ["fresh start", knight, "inactive", knight, true],
    ["draft confirmation", wildcard, "draft-deck", wildcard, true],
    ["difficulty selection", wildcard, "difficulty-select", wildcard, true],
    ["unfinished non-Wildcard", knight, "difficulty-select", knight, false],
    ["different mode", wildcard, "draft-deck", { ...wildcard, contentSystemType: "labyrinth" }, false],
    ["active battle", wildcard, "battle", wildcard, false],
  ] as const)("handles %s", (_label, current, activity, next, expected) => {
    expect(canReplaceRunForStart(current, activity, next)).toBe(expected);
  });
});

it.each([
  ["wildcard", "difficulty-select", true],
  ["wildcard", "draft-deck", false],
  ["knight", "difficulty-select", false],
  ["wildcard", "battle", false],
  [null, "difficulty-select", false],
] as const)("difficulty continuation for %s in %s is %s", (character, activity, expected) => {
  expect(isDifficultySelectContinuation(character, activity)).toBe(expected);
});
