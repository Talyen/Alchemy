import { describe, expect, it, beforeEach, vi } from "vitest";
import { createContentSystemNavigation } from "@/features/alchemy/run/content-system-navigation";
import { useScreenStore } from "@/features/alchemy/stores/screen-store";
import { useRunStore } from "@/features/alchemy/stores/run-store";
import { useHomesteadStore } from "@/features/alchemy/stores/homestead-store";
import { computeTalentEffects } from "@/lib/game-data";
import { CONSTANTS } from "@/features/alchemy/types";
import type { RunStateController, TalentStateController } from "@/features/alchemy/stores/run-store";
import type { BattleCard } from "@/lib/game-data";

vi.mock("@/lib/audio", () => ({
  playGoldGain: vi.fn(),
}));

vi.mock("@/features/alchemy/navigation/run-navigation-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/navigation/run-navigation-helpers")>();
  return {
    ...actual,
    afterCampaignCharacterResolved: vi.fn((_id, _deps, onContinue) => onContinue()),
  };
});

beforeEach(() => {
  useScreenStore.setState(useScreenStore.getInitialState());
  useRunStore.setState(useRunStore.getInitialState());
  useHomesteadStore.setState(useHomesteadStore.getInitialState());
});

function makeRunController(): RunStateController {
  const s = useRunStore.getState();
  return {
    characterId: s.characterId,
    runDeck: s.runDeck,
    runGold: s.runGold,
    runPlayerHealth: s.runPlayerHealth,
    runMaxHealth: s.runMaxHealth,
    roomsEncountered: s.roomsEncountered,
    currentAct: s.currentAct,
    destinationIndexInAct: s.destinationIndexInAct,
    completedDestinations: s.completedDestinations,
    runTrinkets: s.runTrinkets,
    encounteredRunEnemyIds: s.encounteredRunEnemyIds,
    selectedDifficulty: s.selectedDifficulty,
    contentSystemType: s.contentSystemType,
    setRunDeck: s.setRunDeck,
    setRunGold: s.setRunGold,
    setRunPlayerHealth: s.setRunPlayerHealth,
    setRunMaxHealth: s.setRunMaxHealth,
    setRoomsEncountered: s.setRoomsEncountered,
    setCurrentAct: s.setCurrentAct,
    setDestinationIndexInAct: s.setDestinationIndexInAct,
    setCompletedDestinations: s.setCompletedDestinations,
    setRunTrinkets: s.setRunTrinkets,
    setEncounteredRunEnemyIds: s.setEncounteredRunEnemyIds,
    setSelectedDifficulty: s.setSelectedDifficulty,
    setContentSystemType: s.setContentSystemType,
    setCharacter: s.setCharacter,
    reset: s.reset,
    addRunGold: s.addRunGold,
    hydrateFromSnapshot: s.hydrateFromSnapshot,
  };
}

function makeTalentController(): TalentStateController {
  const s = useRunStore.getState();
  return {
    talentXP: s.talentXP,
    runTalentXP: s.runTalentXP,
    unlockedTalents: s.unlockedTalents,
    talentEffects: computeTalentEffects(s.unlockedTalents),
    awardCardXP: s.awardCardXP,
    unlockTalent: s.unlockTalent,
    unlockAllTalents: s.unlockAllTalents,
    finalizeRunXP: s.finalizeRunXP,
    hydrateFromSnapshot: s.hydrateFromSnapshot,
  };
}

function makeDeps(overrides: Partial<Parameters<typeof createContentSystemNavigation>[0]> = {}) {
  const navigateTo = vi.fn();
  const returnToBattle = vi.fn();
  const onStartBattle = vi.fn();
  const draftedDeckRef = { current: null as BattleCard[] | null };
  return {
    run: makeRunController(),
    talents: makeTalentController(),
    draftedDeckRef,
    hasActiveRun: false,
    hasActiveBattle: false,
    pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
    completedDifficulties: {},
    navigateTo,
    returnToBattle,
    onStartBattle,
    getAvailableDestinations: () => [CONSTANTS.DESTINATIONS.NORMAL_COMBAT],
    setDiscoveredCardIds: vi.fn(),
    setEncounteredEnemyIds: vi.fn(),
    ...overrides,
  };
}

describe("createContentSystemNavigation", () => {
  it("beginCampaign routes to character select when no active run", () => {
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps);
    nav.beginCampaign();
    expect(useScreenStore.getState().pendingContentSystemType).toBe(CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN);
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.CHARACTER_SELECT);
  });

  it("initializeLabyrinthRun navigates to labyrinth map", () => {
    useScreenStore.setState({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH });
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("knight");
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.LABYRINTH_MAP);
    expect(useRunStore.getState().contentSystemType).toBe(CONSTANTS.CONTENT_SYSTEMS.LABYRINTH);
  });

  it("initializeWildwoodRun navigates to wildwood select", () => {
    useScreenStore.setState({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("knight");
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.WILDWOOD_SELECT);
    expect(useRunStore.getState().contentSystemType).toBe(CONSTANTS.CONTENT_SYSTEMS.WILDWOOD);
  });

  it("returns to battle when resuming the same content system with an active battle", () => {
    const deps = makeDeps({
      hasActiveRun: true,
      hasActiveBattle: true,
      pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
    });
    useRunStore.setState({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    nav.beginCampaign();
    expect(deps.returnToBattle).toHaveBeenCalledOnce();
    expect(deps.navigateTo).not.toHaveBeenCalled();
  });

  it("routes wildcard draft to draft-deck screen", () => {
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("wildcard");
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.DRAFT_DECK);
    expect(useScreenStore.getState().pendingCharacterId).toBe("wildcard");
  });
});
