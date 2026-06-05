import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { hydrateActiveRunSession, type ActiveRunHydrationTargets } from "@/lib/active-run-session/hydrate";
import { createActiveRunSnapshot } from "@/lib/active-run-session";
import { ROUTE_SCREENS } from "@/lib/routing";

describe("hydrateActiveRunSession", () => {
  const runStore = { initialize: vi.fn() };
  const battleStore = { initializeActiveBattle: vi.fn() };
  const screenStore = {
    setHasActiveRun: vi.fn(),
    setLabyrinthMap: vi.fn(),
    setActiveLabyrinthModifiers: vi.fn(),
    setActiveLabyrinthRewardModifiers: vi.fn(),
    setActiveLabyrinthPendingNode: vi.fn(),
    applyDestinationChoices: vi.fn(),
  };

  let targets: ActiveRunHydrationTargets;

  beforeEach(() => {
    vi.clearAllMocks();
    targets = { runStore, battleStore, screenStore };
  });

  it("no-ops session fields when activeRun is null", () => {
    hydrateActiveRunSession(null, {}, {}, targets);
    expect(runStore.initialize).toHaveBeenCalledWith(null, {}, {});
    expect(screenStore.setHasActiveRun).not.toHaveBeenCalled();
    expect(screenStore.applyDestinationChoices).not.toHaveBeenCalled();
  });

  it("restores destination choices when currentScreen is destination", () => {
    const activeRun = createActiveRunSnapshot({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 20,
      runMaxHealth: 30,
      roomsEncountered: 1,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      encounteredRunEnemyIds: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      hasActiveBattle: false,
      battleState: defaultBattleState(),
      labyrinthPendingNode: null,
      activeLabyrinthModifiers: [],
      activeLabyrinthRewardModifiers: [],
      runTalentXP: {},
      currentScreen: ROUTE_SCREENS.DESTINATION,
      destinationChoices: ["Campfire", "Mystery", "Merchant's Shop"],
    });

    hydrateActiveRunSession(activeRun, {}, {}, targets);

    expect(screenStore.setHasActiveRun).toHaveBeenCalledWith(true);
    expect(screenStore.applyDestinationChoices).toHaveBeenCalledWith([
      "Campfire",
      "Mystery",
      "Merchant's Shop",
    ]);
  });

  it("skips destination choices when currentScreen is not destination", () => {
    const activeRun = createActiveRunSnapshot({
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 20,
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
      hasActiveBattle: false,
      battleState: defaultBattleState(),
      labyrinthPendingNode: null,
      activeLabyrinthModifiers: [],
      activeLabyrinthRewardModifiers: [],
      runTalentXP: {},
      currentScreen: ROUTE_SCREENS.MENU,
      destinationChoices: ["Campfire"],
    });

    hydrateActiveRunSession(activeRun, {}, {}, targets);

    expect(screenStore.setHasActiveRun).toHaveBeenCalledWith(true);
    expect(screenStore.applyDestinationChoices).not.toHaveBeenCalled();
  });
});
