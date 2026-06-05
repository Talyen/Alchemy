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
      homesteadStartGold: 5,
      homesteadStartMaxHealthBonus: 3,
    });

    expect(result).toMatchObject({
      characterId: "knight",
      contentSystemType: "campaign",
      selectedDifficulty: "difficulty-2",
      runGold: 15,
      runPlayerHealth: MAX_PLAYER_HEALTH + 3,
      runMaxHealth: MAX_PLAYER_HEALTH + 3,
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
      homesteadStartGold: 7,
      homesteadStartMaxHealthBonus: 2,
    });

    expect(result.contentSystemType).toBe("labyrinth");
    expect(result.selectedDifficulty).toBeNull();
    expect(result.runGold).toBe(15);
    expect(result.runPlayerHealth).toBe(MAX_PLAYER_HEALTH + 2);
    expect(result.hasActiveRun).toBe(true);
    expect(result.freshDeck.map((card) => card.id)).toEqual(getStartingDeck("ranger").map((card) => card.id));
  });

  it("creates a fresh non-persistent wildwood snapshot", () => {
    const result = createRunStartSnapshot({
      characterId: "wizard",
      contentSystemType: "wildwood",
      talentStartGold: 99,
      homesteadStartGold: 99,
      homesteadStartMaxHealthBonus: 4,
    });

    expect(result.contentSystemType).toBe("wildwood");
    expect(result.selectedDifficulty).toBeNull();
    expect(result.runGold).toBe(0);
    expect(result.runTrinkets).toEqual([]);
    expect(result.roomsEncountered).toBe(0);
    expect(result.completedDestinations).toEqual([]);
    expect(result.hasActiveRun).toBe(false);
    expect(result.runMaxHealth).toBe(MAX_PLAYER_HEALTH + 4);
    expect(result.freshDeck.map((card) => card.id)).toEqual(getStartingDeck("wizard").map((card) => card.id));
  });

  it("uses draftedDeck for wildcard campaign snapshot", () => {
    const draftedCards: BattleCard[] = [
      { id: "slash", title: "Slash", descriptionLines: [""], art: "", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 4 }] },
      { id: "block", title: "Block", descriptionLines: [""], art: "", cost: 1, effects: [{ kind: "player-status", status: "block", amount: 6 }] },
    ];
    const result = createRunStartSnapshot({
      characterId: "wildcard",
      contentSystemType: "campaign",
      difficultyId: "difficulty-1",
      talentStartGold: 0,
      homesteadStartGold: 0,
      homesteadStartMaxHealthBonus: 0,
      draftedDeck: draftedCards,
    });

    expect(result.characterId).toBe("wildcard");
    expect(result.freshDeck).toEqual(draftedCards);
    expect(result.freshDeck).not.toEqual(getStartingDeck("wildcard"));
    expect(result.contentSystemType).toBe("campaign");
    expect(result.selectedDifficulty).toBe("difficulty-1");
    expect(result.hasActiveRun).toBe(true);
  });

  it("falls back to character starting deck when no draftedDeck provided for wildcard", () => {
    const result = createRunStartSnapshot({
      characterId: "wildcard",
      contentSystemType: "campaign",
      difficultyId: "difficulty-1",
      talentStartGold: 0,
      homesteadStartGold: 0,
      homesteadStartMaxHealthBonus: 0,
    });

    expect(result.freshDeck).toEqual(getStartingDeck("wildcard"));
    expect(result.freshDeck).toEqual([]);
  });
});
