import { describe, expect, it } from "vitest";

import { defaultBattleState } from "@/lib/battle";
import { getStartingDeck } from "@/lib/game-data";
import { createActiveRunSnapshot } from "@/lib/active-run-session";

function makeSource(
  overrides: Partial<Parameters<typeof createActiveRunSnapshot>[0]> = {},
): Parameters<typeof createActiveRunSnapshot>[0] {
  return {
    characterId: "knight",
    runDeck: getStartingDeck("knight"),
    runGold: 42,
    runPlayerHealth: 18,
    runMaxHealth: 32,
    roomsEncountered: 4,
    currentAct: 2,
    destinationIndexInAct: 1,
    completedDestinations: ["Normal Combat", "Campfire"],
    lastOfferedDestinations: ["Mystery", "Campfire", "Merchant's Shop"],
    destinationRoundsSinceOffered: { Mystery: 2 },
    runTrinkets: ["bone-charm"],
    encounteredRunEnemyIds: ["goblin"],
    selectedDifficulty: null,
    contentSystemType: "campaign",
    labyrinthMap: null,
    hasActiveBattle: false,
    battleState: defaultBattleState(),
    labyrinthPendingNode: null,
    activeLabyrinthModifiers: [],
    activeLabyrinthRewardModifiers: [],
    runTalentXP: {},
    currentScreen: null,
    destinationChoices: [],
    pendingReward: null,
    wildwoodDraft: null,
    runMaterialsEarned: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
    shopState: null,
    alchemistState: null,
    trinketShopState: null,
    equipmentShopState: null,
    ...overrides,
  };
}

describe("createActiveRunSnapshot", () => {
  it("copies only persisted active-run fields", () => {
    const runDeck = getStartingDeck("knight");
    const result = createActiveRunSnapshot(
      makeSource({
        runDeck,
      }),
    );

    expect(result).toEqual({
      characterId: "knight",
      runDeck,
      runGold: 42,
      runPlayerHealth: 18,
      runMaxHealth: 32,
      roomsEncountered: 4,
      currentAct: 2,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat", "Campfire"],
      lastOfferedDestinations: ["Mystery", "Campfire", "Merchant's Shop"],
      destinationRoundsSinceOffered: { Mystery: 2 },
      runTrinkets: ["bone-charm"],
      encounteredRunEnemyIds: ["goblin"],
      runTalentXP: {},
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      labyrinthPendingNode: null,
      activeCombat: null,
      currentScreen: null,
      destinationChoices: [],
      pendingReward: null,
      wildwoodDraft: null,
      runMaterialsEarned: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
    });
  });

  it("includes contentSystemType field defaulting to campaign", () => {
    const runDeck = getStartingDeck("knight");
    const result = createActiveRunSnapshot(
      makeSource({
        runDeck,
        runGold: 0,
        runPlayerHealth: 30,
        runMaxHealth: 30,
        roomsEncountered: 0,
        currentAct: 1,
        destinationIndexInAct: 0,
        completedDestinations: [],
        runTrinkets: [],
        encounteredRunEnemyIds: [],
        selectedDifficulty: null,
        contentSystemType: "campaign",
        labyrinthMap: null,
      }),
    );
    expect(result.contentSystemType).toBe("campaign");
  });

  it("can set contentSystemType to labyrinth", () => {
    const runDeck = getStartingDeck("knight");
    const result = createActiveRunSnapshot(
      makeSource({
        runDeck,
        runGold: 0,
        runPlayerHealth: 30,
        runMaxHealth: 30,
        roomsEncountered: 0,
        currentAct: 1,
        destinationIndexInAct: 0,
        completedDestinations: [],
        runTrinkets: [],
        encounteredRunEnemyIds: [],
        selectedDifficulty: null,
        contentSystemType: "labyrinth",
        labyrinthMap: null,
      }),
    );
    expect(result.contentSystemType).toBe("labyrinth");
  });

  it("persists active campaign combat state", () => {
    const battleState = { ...defaultBattleState(), turn: 3, playerHealth: 12 };
    const result = createActiveRunSnapshot(makeSource({ hasActiveBattle: true, battleState }));

    expect(result.activeCombat?.battleState).toBe(battleState);
  });

  it("persists the current state during enemy phase instead of reverting to battle start", () => {
    const enemyPhaseState = { ...defaultBattleState(), turn: 2, turnPhase: "enemy" as const, hand: [] };
    const result = createActiveRunSnapshot(
      makeSource({
        hasActiveBattle: true,
        battleState: enemyPhaseState,
      }),
    );

    expect(result.activeCombat?.battleState).toBe(enemyPhaseState);
    expect(result.activeCombat!.battleState.turn).toBe(2);
    expect(result.activeCombat!.battleState.turnPhase).toBe("enemy");
  });

  it("persists labyrinth pending node and modifiers during combat", () => {
    const result = createActiveRunSnapshot(
      makeSource({
        contentSystemType: "labyrinth",
        hasActiveBattle: true,
        labyrinthPendingNode: { row: 1, col: 2 },
        activeLabyrinthModifiers: ["tempered"],
        activeLabyrinthRewardModifiers: ["generous"],
      }),
    );

    expect(result.labyrinthPendingNode).toEqual({ row: 1, col: 2 });
    expect(result.activeCombat?.activeLabyrinthModifiers).toEqual(["tempered"]);
    expect(result.activeCombat?.activeLabyrinthRewardModifiers).toEqual(["generous"]);
  });

  it("skips active combat when enemy health is zero", () => {
    const battleState = { ...defaultBattleState(), turn: 5, enemyHealth: 0 };
    const result = createActiveRunSnapshot(makeSource({ hasActiveBattle: true, battleState }));

    expect(result.activeCombat).toBeNull();
  });

  it("skips active combat when player is defeated", () => {
    const battleState = {
      ...defaultBattleState(),
      turn: 3,
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: false,
    };
    const result = createActiveRunSnapshot(makeSource({ hasActiveBattle: true, battleState }));

    expect(result.activeCombat).toBeNull();
  });

  it("persists runTalentXP", () => {
    const runTalentXP = { burn: 10, poison: 5 };
    const result = createActiveRunSnapshot(makeSource({ runTalentXP }));

    expect(result.runTalentXP).toEqual(runTalentXP);
  });

  it("persists destination resume fields", () => {
    const result = createActiveRunSnapshot(
      makeSource({
        currentScreen: "destination",
        destinationChoices: ["Campfire", "Merchant's Shop"],
      }),
    );

    expect(result.currentScreen).toBe("destination");
    expect(result.destinationChoices).toEqual(["Campfire", "Merchant's Shop"]);
  });

  it("persists Wildwood Draft phase state", () => {
    const wildwoodDraft = {
      version: 3 as const,
      phase: "reward" as const,
      draftChoices: [],
      remainingBossIds: ["iron-bear"] as const,
      previousBossId: "forge-golem" as const,
      currentBossId: "frostwarden" as const,
      currentCombatTraitIds: ["tempered" as const],
      currentRewardTraitIds: ["alchemist" as const],
      rewardType: "card" as const,
      rewardChoiceIds: ["slash", "block"],
      rewardGearChoices: [],
      selectedRewardId: "slash",
    };

    const result = createActiveRunSnapshot(makeSource({ contentSystemType: "wildwood", wildwoodDraft }));

    expect(result.wildwoodDraft).toEqual(wildwoodDraft);
  });
});
