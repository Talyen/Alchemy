import { makeTestCard } from "../../../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { getStartingDeck } from "@/lib/game-data";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { createRunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { createInitialActiveRunFields } from "@/features/alchemy/shared/stores/run-state-init";
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
    "starts %s with an independent deck, its supported difficulty, and fresh progress",
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
        roomsEncountered: 0,
        currentAct: 1,
        destinationIndexInAct: 0,
        completedDestinations: [],
        runBoons: [],
        hasActiveRun: true,
      });
      expect(result.freshDeck).toEqual(getStartingDeck("knight"));
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
    expect(result.freshDeck).toEqual(draftedCards);
    expect(result.freshDeck).not.toEqual(getStartingDeck("wildcard"));
    expect(result.contentSystemType).toBe("campaign");
    expect(result.selectedDifficulty).toBe("difficulty-1");
    expect(result.hasActiveRun).toBe(true);
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

    expect(result.freshDeck).toEqual(getStartingDeck("wildcard"));
    expect(result.freshDeck).toEqual([]);
  });
});

describe("canReplaceRunForStart", () => {
  it("allows fresh starts", () => {
    expect(
      canReplaceRunForStart({
        isFreshStart: true,
        activeCharacterId: null,
        snapshotCharacterId: "knight",
        activeContentSystemType: null,
        snapshotContentSystemType: "campaign",
        hasActiveBattle: false,
        activityKind: "inactive",
      }),
    ).toBe(true);
  });

  it("allows a wildcard draft to re-apply its own snapshot at draft confirm or difficulty select", () => {
    for (const activityKind of ["draft-deck", "difficulty-select"]) {
      expect(
        canReplaceRunForStart({
          isFreshStart: false,
          activeCharacterId: "wildcard",
          snapshotCharacterId: "wildcard",
          activeContentSystemType: "campaign",
          snapshotContentSystemType: "campaign",
          hasActiveBattle: false,
          activityKind,
        }),
      ).toBe(true);
    }
  });

  it("rejects replacing an unfinished non-wildcard run", () => {
    expect(
      canReplaceRunForStart({
        isFreshStart: false,
        activeCharacterId: "knight",
        snapshotCharacterId: "knight",
        activeContentSystemType: "campaign",
        snapshotContentSystemType: "campaign",
        hasActiveBattle: false,
        activityKind: "difficulty-select",
      }),
    ).toBe(false);
  });

  it("rejects cross-system replacement and mid-battle replacement", () => {
    expect(
      canReplaceRunForStart({
        isFreshStart: false,
        activeCharacterId: "wildcard",
        snapshotCharacterId: "wildcard",
        activeContentSystemType: "campaign",
        snapshotContentSystemType: "labyrinth",
        hasActiveBattle: false,
        activityKind: "draft-deck",
      }),
    ).toBe(false);
    expect(
      canReplaceRunForStart({
        isFreshStart: false,
        activeCharacterId: "wildcard",
        snapshotCharacterId: "wildcard",
        activeContentSystemType: "campaign",
        snapshotContentSystemType: "campaign",
        hasActiveBattle: true,
        activityKind: "difficulty-select",
      }),
    ).toBe(false);
  });
});

it("isDifficultySelectContinuation proceeds only for a wildcard run waiting at difficulty select outside battle", () => {
  expect(
    isDifficultySelectContinuation({
      characterId: "wildcard",
      activityKind: "difficulty-select",
      hasActiveBattle: false,
    }),
  ).toBe(true);
  expect(
    isDifficultySelectContinuation({ characterId: "wildcard", activityKind: "draft-deck", hasActiveBattle: false }),
  ).toBe(false);
  expect(
    isDifficultySelectContinuation({
      characterId: "knight",
      activityKind: "difficulty-select",
      hasActiveBattle: false,
    }),
  ).toBe(false);
  expect(
    isDifficultySelectContinuation({
      characterId: "wildcard",
      activityKind: "difficulty-select",
      hasActiveBattle: true,
    }),
  ).toBe(false);
  expect(
    isDifficultySelectContinuation({ characterId: null, activityKind: "difficulty-select", hasActiveBattle: false }),
  ).toBe(false);
});
