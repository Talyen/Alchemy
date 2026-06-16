import { describe, expect, it, beforeEach, vi } from "vitest";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/shared/stores/homestead-store";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import { makeRunController, makeTalentController } from "../../helpers/run-controller";
import { DEFAULT_CAMPAIGN_DIFFICULTY_ID, DRAFT_ROUNDS } from "@/lib/game-constants";
import { getStartingDeck, type BattleCard } from "@/lib/game-data";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunProgressSlice,
  setRunProgress,
  setRunSession,
} from "../../helpers/run-domain-store-test";

vi.mock("@/lib/audio", () => ({
  playGoldGain: vi.fn(),
}));

vi.mock("@/features/alchemy/run-loop/navigation/run-navigation-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/run-loop/navigation/run-navigation-helpers")>();
  return {
    ...actual,
    afterCampaignCharacterResolved: vi.fn((_id, _deps, onContinue) => onContinue()),
  };
});

beforeEach(() => {
  resetTransientRunUi();
  resetRunProgressSlice();
  useHomesteadStore.setState(useHomesteadStore.getInitialState());
  useAppStore.setState({ discoveredCardIds: [], discoveredTrinketIds: [] });
});

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
    onResumeWildwood: vi.fn(),
    onStartNextWildwoodBoss: vi.fn(),
    ...overrides,
  };
}

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "test-card", title: "Test", descriptionLines: [""], art: "", cost: 1, effects: [], ...overrides };
}

describe("createContentSystemNavigation", () => {
  it("beginCampaign routes to character select when no active run", () => {
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps);
    nav.beginCampaign();
    expect(getRunSessionStoreView().pendingContentSystemType).toBe(CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN);
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.CHARACTER_SELECT);
  });

  it("initializeLabyrinthRun navigates to labyrinth map", () => {
    setRunSession({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH });
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("knight");
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.LABYRINTH_MAP);
    expect(getRunProgressStoreView().contentSystemType).toBe(CONSTANTS.CONTENT_SYSTEMS.LABYRINTH);
  });

  it("initializeWildwoodRun creates a resumable draft and navigates to draft deck", () => {
    setRunSession({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("knight");
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.DRAFT_DECK);
    expect(getRunProgressStoreView().contentSystemType).toBe(CONSTANTS.CONTENT_SYSTEMS.WILDWOOD);
    expect(getRunProgressStoreView().runDeck).toEqual([]);
    expect(getRunSessionStoreView().hasActiveRun).toBe(true);
    expect(getRunSessionStoreView().wildwoodDraft?.draftChoices).toHaveLength(3);
  });

  it("returns to battle when resuming the same content system with an active battle", () => {
    const deps = makeDeps({
      hasActiveRun: true,
      hasActiveBattle: true,
      pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
    });
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    nav.beginCampaign();
    expect(deps.returnToBattle).toHaveBeenCalledOnce();
    expect(deps.navigateTo).not.toHaveBeenCalled();
  });

  it("initializeRunForDifficulty discovers starter deck on a fresh save", () => {
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps);
    const knightStarterIds = getStartingDeck("knight").map((card) => card.id);

    nav.initializeRunForDifficulty("knight", DEFAULT_CAMPAIGN_DIFFICULTY_ID);

    expect(useAppStore.getState().discoveredCardIds).toEqual(knightStarterIds);
  });

  it("initializeWildwoodRun does not discover the normal starter deck", () => {
    setRunSession({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("knight");

    expect(useAppStore.getState().discoveredCardIds).toEqual([]);
  });

  it("routes wildcard draft to draft-deck screen", () => {
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("wildcard");
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.DRAFT_DECK);
    expect(getRunSessionStoreView().pendingCharacterId).toBe("wildcard");
  });

  it("wildcard Wildwood draft complete starts the gauntlet with the drafted deck", () => {
    setRunSession({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    const onStartNextWildwoodBoss = vi.fn();
    const deps = makeDeps({
      pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD,
      onStartNextWildwoodBoss,
    });
    const nav = createContentSystemNavigation(deps);
    const draftedCards = Array.from({ length: DRAFT_ROUNDS }, (_, index) =>
      makeCard({ id: `wildcard-draft-${index}` }),
    );

    nav.handleDraftComplete(draftedCards);

    expect(getRunProgressStoreView().contentSystemType).toBe(CONSTANTS.CONTENT_SYSTEMS.WILDWOOD);
    expect(getRunProgressStoreView().runDeck).toEqual(draftedCards);
    expect(getRunSessionStoreView().wildwoodDraft).not.toBeNull();
    expect(getRunSessionStoreView().pendingCharacterId).toBeNull();
    expect(onStartNextWildwoodBoss).toHaveBeenCalledOnce();
    expect(deps.navigateTo).not.toHaveBeenCalledWith(CONSTANTS.SCREENS.DRAFT_DECK);
  });
});
