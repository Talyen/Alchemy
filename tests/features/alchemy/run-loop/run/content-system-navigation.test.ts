import { describe, expect, it, beforeEach, vi } from "vitest";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { useProfileStore } from "../../../../helpers/gameplay-store-test";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import { makeRunController, makeTalentController } from "../../../../helpers/run-controller";
import { DEFAULT_CAMPAIGN_DIFFICULTY_ID, DRAFT_ROUNDS } from "@/lib/game-constants";
import { getStartingDeck } from "@/lib/game-data";
import { makeTestCard } from "../../../../fixtures/battle";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunProgressSlice,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";

vi.mock("@/lib/audio", () => ({
  playGoldGain: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/run-flow/campaign-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/run-flow/campaign-start")>();
  return {
    ...actual,
    afterCampaignCharacterResolved: vi.fn((_id, _deps, onContinue) => onContinue()),
  };
});

beforeEach(() => {
  resetTransientRunUi();
  resetRunProgressSlice();
  useProfileStore.setState({ discoveredCardIds: [], discoveredTrinketIds: [] });
});

function makeDeps(overrides: Partial<Parameters<typeof createContentSystemNavigation>[0]> = {}) {
  const navigateTo = vi.fn();
  const returnToBattle = vi.fn();
  const onStartBattle = vi.fn();
  return {
    run: makeRunController(),
    talents: makeTalentController(),
    hasActiveRun: false,
    hasActiveBattle: false,
    pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
    completedDifficulties: {},
    navigateTo,
    returnToBattle,
    onStartBattle,
    getAvailableDestinations: () => [CONSTANTS.DESTINATIONS.NORMAL_COMBAT],
    onResumeWildwood: vi.fn(),
    destinationRng: () => 0.5,
    worldRng: () => 0.5,
    clearCardHover: vi.fn(),
    ...overrides,
  };
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

    expect(useProfileStore.getState().discoveredCardIds).toEqual(knightStarterIds);
  });

  it("commits the initial destination offer and reward together", () => {
    setRunProgress({ runDeck: [] });
    const getAvailableDestinations = vi.fn(() => [CONSTANTS.DESTINATIONS.NORMAL_COMBAT]);
    const deps = makeDeps({
      getAvailableDestinations,
    });
    const nav = createContentSystemNavigation(deps);
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    nav.initializeRunForDifficulty("knight", DEFAULT_CAMPAIGN_DIFFICULTY_ID);

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(getAvailableDestinations).toHaveBeenCalledWith({
      currentHealth: expect.any(Number),
      currentGold: expect.any(Number),
      destinationIndexInAct: 0,
      maxHealth: expect.any(Number),
    });
    expect(getRunSessionStoreView().rewardState.destinations).toEqual([CONSTANTS.DESTINATIONS.NORMAL_COMBAT]);
    expect(getRunProgressStoreView().lastOfferedDestinations).toEqual([CONSTANTS.DESTINATIONS.NORMAL_COMBAT]);
  });

  it("initializeWildwoodRun does not discover the normal starter deck", () => {
    setRunSession({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("knight");

    expect(useProfileStore.getState().discoveredCardIds).toEqual([]);
  });

  it("starts a resumable campaign Wildcard draft with seeded choices", () => {
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("wildcard");
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.DRAFT_DECK);
    expect(getRunSessionStoreView().pendingCharacterId).toBe("wildcard");
    expect(getRunSessionStoreView().hasActiveRun).toBe(true);
    expect(getRunProgressStoreView().characterId).toBe("wildcard");
    expect(getRunProgressStoreView().runDeck).toEqual([]);
    expect(getRunSessionStoreView().starterDraftChoices).toHaveLength(3);
  });

  it("resumes an incomplete campaign Wildcard draft to the draft screen", () => {
    setRunProgress({ characterId: "wildcard", contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN, runDeck: [] });
    setRunSession({
      hasActiveRun: true,
      starterDraftChoices: [
        makeTestCard({ id: "draft-a" }),
        makeTestCard({ id: "draft-b" }),
        makeTestCard({ id: "draft-c" }),
      ],
    });
    const deps = makeDeps({
      hasActiveRun: true,
      pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
    });
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN, characterId: "wildcard" });
    const nav = createContentSystemNavigation(deps);
    nav.beginCampaign();
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.DRAFT_DECK);
  });

  it("appends a starter-draft pick and rolls the next seeded choices", () => {
    setRunSession({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("wildcard");
    const firstChoices = getRunSessionStoreView().starterDraftChoices;
    expect(firstChoices).toHaveLength(3);
    const picked = firstChoices![0]!;
    nav.handleStarterDraftPick(picked);
    expect(getRunProgressStoreView().runDeck.map((card) => card.id)).toEqual([picked.id]);
    expect(getRunSessionStoreView().starterDraftChoices).toHaveLength(3);
    expect(getRunSessionStoreView().starterDraftChoices?.some((card) => card.id === picked.id)).toBe(false);
  });

  it("rejects starter-draft picks that are not in the current offer", () => {
    setRunSession({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("wildcard");
    nav.handleStarterDraftPick(makeTestCard({ id: "not-offered" }));
    expect(getRunProgressStoreView().runDeck).toEqual([]);
  });

  it("keeps an empty starter-draft offer after the final pick so labyrinth can resume to draft confirm", () => {
    setRunSession({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH });
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("wildcard");
    for (let round = 0; round < DRAFT_ROUNDS; round += 1) {
      const choices = getRunSessionStoreView().starterDraftChoices;
      expect(choices?.length).toBeGreaterThan(0);
      nav.handleStarterDraftPick(choices![0]!);
    }
    expect(getRunProgressStoreView().runDeck).toHaveLength(DRAFT_ROUNDS);
    expect(getRunSessionStoreView().starterDraftChoices).toEqual([]);
  });

  it("resumes a completed labyrinth Wildcard draft to the draft screen until run init", () => {
    const drafted = Array.from({ length: DRAFT_ROUNDS }, (_, index) => makeTestCard({ id: `lab-draft-${index}` }));
    setRunProgress({
      characterId: "wildcard",
      contentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH,
      runDeck: drafted,
    });
    setRunSession({
      hasActiveRun: true,
      starterDraftChoices: [],
    });
    const deps = makeDeps({
      hasActiveRun: true,
      pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH,
    });
    const nav = createContentSystemNavigation(deps);
    nav.beginLabyrinth();
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.DRAFT_DECK);
  });

  it("uses the standard draft owner to start a wildcard campaign", () => {
    setRunSession({ pendingCharacterId: "wildcard", pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    const draftedCards = Array.from({ length: DRAFT_ROUNDS }, (_, index) =>
      makeTestCard({ id: `campaign-draft-${index}` }),
    );

    nav.handleStandardDraftComplete(draftedCards);
    nav.handleDifficultySelect(DEFAULT_CAMPAIGN_DIFFICULTY_ID);

    expect(getRunProgressStoreView().contentSystemType).toBe(CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN);
    expect(getRunProgressStoreView().runDeck).toEqual(draftedCards);
    expect(deps.onStartBattle).toHaveBeenCalledOnce();
  });
});
