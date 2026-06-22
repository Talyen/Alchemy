import { describe, expect, it } from "vitest";
import { getStartingDeck, type BattleCard } from "@/lib/game-data";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { createRunStartSnapshot } from "@/features/alchemy/run-setup/run/run-start";

describe("createRunStartSnapshot", () => {
  it("creates a campaign snapshot with difficulty, start gold, and route reset", () => {
    const result = createRunStartSnapshot({
      characterId: "knight",
      contentSystemType: "campaign",
      difficultyId: "difficulty-2",
      talentStartGold: 10,
      talentXP: {},
    });

    expect(result).toMatchObject({
      characterId: "knight",
      contentSystemType: "campaign",
      selectedDifficulty: "difficulty-2",
      runGold: 10,
      runPlayerHealth: MAX_PLAYER_HEALTH,
      runMaxHealth: MAX_PLAYER_HEALTH,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      hasActiveRun: true,
    });
    expect(result.freshDeck.map((card) => card.id)).toEqual(getStartingDeck("knight").map((card) => card.id));
  });

  it("creates a labyrinth snapshot without difficulty but with start gold", () => {
    const result = createRunStartSnapshot({
      characterId: "ranger",
      contentSystemType: "labyrinth",
      difficultyId: "difficulty-3",
      talentStartGold: 8,
      talentXP: {},
    });

    expect(result.contentSystemType).toBe("labyrinth");
    expect(result.selectedDifficulty).toBeNull();
    expect(result.runGold).toBe(8);
    expect(result.runPlayerHealth).toBe(MAX_PLAYER_HEALTH);
    expect(result.hasActiveRun).toBe(true);
    expect(result.freshDeck.map((card) => card.id)).toEqual(getStartingDeck("ranger").map((card) => card.id));
  });

  it("creates a resumable wildwood snapshot", () => {
    const result = createRunStartSnapshot({
      characterId: "wizard",
      contentSystemType: "wildwood",
      talentStartGold: 99,
      talentXP: {},
    });

    expect(result.contentSystemType).toBe("wildwood");
    expect(result.selectedDifficulty).toBeNull();
    expect(result.runGold).toBe(0);
    expect(result.runTrinkets).toEqual([]);
    expect(result.roomsEncountered).toBe(0);
    expect(result.completedDestinations).toEqual([]);
    expect(result.hasActiveRun).toBe(true);
    expect(result.runMaxHealth).toBe(MAX_PLAYER_HEALTH);
    expect(result.freshDeck.map((card) => card.id)).toEqual(getStartingDeck("wizard").map((card) => card.id));
  });

  it("uses draftedDeck for wildcard campaign snapshot", () => {
    const draftedCards: BattleCard[] = [
      {
        id: "slash",
        title: "Slash",
        descriptionLines: [""],
        art: "",
        cost: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
      },
      {
        id: "block",
        title: "Block",
        descriptionLines: [""],
        art: "",
        cost: 1,
        effects: [{ kind: "player-status", status: "block", amount: 6 }],
      },
    ];
    const result = createRunStartSnapshot({
      characterId: "wildcard",
      contentSystemType: "campaign",
      difficultyId: "difficulty-1",
      talentStartGold: 0,
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
      talentStartGold: 0,
      talentXP: { physical: 10, health: 30 },
    });

    expect(result.runMaxHealth).toBe(MAX_PLAYER_HEALTH + 3);
    expect(result.runPlayerHealth).toBe(MAX_PLAYER_HEALTH + 3);
  });

  it("adds gear max-health bonus to run cap at run start", () => {
    const result = createRunStartSnapshot({
      characterId: "knight",
      contentSystemType: "campaign",
      talentStartGold: 0,
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
      talentStartGold: 0,
      talentXP: {},
    });

    expect(result.freshDeck).toEqual(getStartingDeck("wildcard"));
    expect(result.freshDeck).toEqual([]);
  });
});
