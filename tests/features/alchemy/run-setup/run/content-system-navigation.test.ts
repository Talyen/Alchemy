import "../../../../helpers/mock-audio";
import { describe, expect, it, beforeEach, vi, type Mock } from "vitest";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import { makeRunController, makeTalentController } from "../../../../helpers/run-controller";
import { DEFAULT_CAMPAIGN_DIFFICULTY_ID, DRAFT_ROUNDS } from "@/lib/game-constants";
import { makeTestCard } from "../../../../fixtures/battle";
import { setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import {
  dispatchRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readParkedRuns, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { getStartingDeck } from "@/lib/game-data";

vi.mock("@/features/alchemy/shared/run-flow/campaign-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/run-flow/campaign-start")>();
  return {
    ...actual,
    afterCampaignCharacterResolved: vi.fn((_id, _deps, onContinue) => onContinue()),
  };
});

beforeEach(() => {
  resetAllTestStores();
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
    pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN,
    completedDifficulties: {},
    navigateTo,
    returnToBattle,
    onStartBattle,
    getAvailableDestinations: () => [DESTINATIONS.NORMAL_COMBAT],
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
    expect(readRunSession().pendingContentSystemType).toBe(CONTENT_SYSTEMS.CAMPAIGN);
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.CHARACTER_SELECT);
  });

  it("initializeLabyrinthRun navigates to labyrinth map", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH });
    const deps = makeDeps({ pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("knight");
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.LABYRINTH_MAP);
    expect(readActiveRun().contentSystemType).toBe(CONTENT_SYSTEMS.LABYRINTH);
  });

  it("initializeWildwoodRun creates a resumable draft and navigates to draft deck", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.WILDWOOD });
    const deps = makeDeps({ pendingContentSystemType: CONTENT_SYSTEMS.WILDWOOD });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("knight");
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DRAFT_DECK);
    expect(readActiveRun().contentSystemType).toBe(CONTENT_SYSTEMS.WILDWOOD);
    expect(readActiveRun().runDeck).toEqual([]);
    expect(readRunSession().hasActiveRun).toBe(true);
    expect(readRunSession().wildwoodDraft?.draftChoices).toHaveLength(3);
  });

  it("returns to battle when resuming the same content system with an active battle", () => {
    const deps = makeDeps({
      hasActiveRun: true,
      hasActiveBattle: true,
      pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN,
    });
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
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

    expect(readProfileStore().discoveredCardIds).toEqual(knightStarterIds);
  });

  it("commits the initial destination offer and reward together", () => {
    setRunProgress({ runDeck: [] });
    const getAvailableDestinations = vi.fn(() => [DESTINATIONS.NORMAL_COMBAT]);
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
    expect(readRunSession().rewardState.destinations).toEqual([DESTINATIONS.NORMAL_COMBAT]);
    expect(readActiveRun().lastOfferedDestinations).toEqual([DESTINATIONS.NORMAL_COMBAT]);
  });

  it("initializeWildwoodRun does not discover the normal starter deck", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.WILDWOOD });
    const deps = makeDeps({ pendingContentSystemType: CONTENT_SYSTEMS.WILDWOOD });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("knight");

    expect(readProfileStore().discoveredCardIds).toEqual([]);
  });

  it("starts a resumable campaign Wildcard draft with seeded choices", () => {
    const deps = makeDeps({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("wildcard");
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DRAFT_DECK);
    expect(readRunSession().pendingCharacterId).toBe("wildcard");
    expect(readRunSession().hasActiveRun).toBe(true);
    expect(readActiveRun().characterId).toBe("wildcard");
    expect(readActiveRun().runDeck).toEqual([]);
    expect(readRunSession().starterDraftChoices).toHaveLength(3);
  });

  it("resumes an incomplete campaign Wildcard draft to the draft screen", () => {
    setRunProgress({ characterId: "wildcard", contentSystemType: CONTENT_SYSTEMS.CAMPAIGN, runDeck: [] });
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
      pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN,
    });
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.CAMPAIGN, characterId: "wildcard" });
    const nav = createContentSystemNavigation(deps);
    nav.beginCampaign();
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DRAFT_DECK);
  });

  it("appends a starter-draft pick and rolls the next seeded choices", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const deps = makeDeps({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("wildcard");
    const firstChoices = readRunSession().starterDraftChoices;
    expect(firstChoices).toHaveLength(3);
    const picked = firstChoices![0]!;
    nav.handleStarterDraftPick(picked);
    expect(readActiveRun().runDeck.map((card) => card.id)).toEqual([picked.id]);
    expect(readRunSession().starterDraftChoices).toHaveLength(3);
    expect(readRunSession().starterDraftChoices?.some((card) => card.id === picked.id)).toBe(false);
  });

  it("rejects starter-draft picks that are not in the current offer", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const deps = makeDeps({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("wildcard");
    nav.handleStarterDraftPick(makeTestCard({ id: "not-offered" }));
    expect(readActiveRun().runDeck).toEqual([]);
  });

  it("keeps an empty starter-draft offer after the final pick so labyrinth can resume to draft confirm", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH });
    const deps = makeDeps({ pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("wildcard");
    for (let round = 0; round < DRAFT_ROUNDS; round += 1) {
      const choices = readRunSession().starterDraftChoices;
      expect(choices?.length).toBeGreaterThan(0);
      nav.handleStarterDraftPick(choices![0]!);
    }
    expect(readActiveRun().runDeck).toHaveLength(DRAFT_ROUNDS);
    expect(readRunSession().starterDraftChoices).toEqual([]);
  });

  it("resumes a completed labyrinth Wildcard draft to the draft screen until run init", () => {
    const drafted = Array.from({ length: DRAFT_ROUNDS }, (_, index) => makeTestCard({ id: `lab-draft-${index}` }));
    setRunProgress({
      characterId: "wildcard",
      contentSystemType: CONTENT_SYSTEMS.LABYRINTH,
      runDeck: drafted,
    });
    setRunSession({
      hasActiveRun: true,
      starterDraftChoices: [],
    });
    const deps = makeDeps({
      hasActiveRun: true,
      pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH,
    });
    const nav = createContentSystemNavigation(deps);
    nav.beginLabyrinth();
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DRAFT_DECK);
  });

  it("uses the standard draft owner to start a wildcard campaign", () => {
    setRunSession({ pendingCharacterId: "wildcard", pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const deps = makeDeps({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    const draftedCards = Array.from({ length: DRAFT_ROUNDS }, (_, index) =>
      makeTestCard({ id: `campaign-draft-${index}` }),
    );

    nav.handleStandardDraftComplete(draftedCards);
    nav.handleDifficultySelect(DEFAULT_CAMPAIGN_DIFFICULTY_ID);

    expect(readActiveRun().contentSystemType).toBe(CONTENT_SYSTEMS.CAMPAIGN);
    expect(readActiveRun().runDeck).toEqual(draftedCards);
    expect(deps.onStartBattle).toHaveBeenCalledOnce();
  });

  it("parks the live campaign when beginning another mode", () => {
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.CAMPAIGN, characterId: "knight" });
    setRunSession({ hasActiveRun: true });
    dispatchRunSessionCommand((draft) => setScreen(draft, ROUTE_SCREENS.DESTINATION));
    const deps = makeDeps({
      hasActiveRun: true,
      pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH,
    });
    const nav = createContentSystemNavigation(deps);
    nav.beginLabyrinth();
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.CHARACTER_SELECT);
    expect(readRunSession().hasActiveRun).toBe(false);
    expect(readParkedRuns().campaign?.contentSystemType).toBe(CONTENT_SYSTEMS.CAMPAIGN);
  });

  it("resumes a parked campaign instead of opening character select", () => {
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.CAMPAIGN, characterId: "knight" });
    setRunSession({ hasActiveRun: true });
    dispatchRunSessionCommand((draft) => setScreen(draft, ROUTE_SCREENS.DESTINATION));
    const deps = makeDeps({
      hasActiveRun: true,
      pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH,
    });
    createContentSystemNavigation(deps).beginLabyrinth();

    const resume = makeDeps({ hasActiveRun: false });
    const nav = createContentSystemNavigation(resume);
    nav.beginCampaign();
    expect(resume.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DESTINATION, expect.any(Function));
    expect(readRunSession().hasActiveRun).toBe(true);
    expect(readActiveRun().contentSystemType).toBe(CONTENT_SYSTEMS.CAMPAIGN);
  });

  it("samples resumed campaign destinations from the hydrated run", () => {
    setRunProgress({
      contentSystemType: CONTENT_SYSTEMS.CAMPAIGN,
      characterId: "knight",
      destinationIndexInAct: 2,
      completedDestinations: [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.CAMPFIRE],
      runPlayerHealth: 12,
      runMaxHealth: 30,
    });
    setRunSession({ hasActiveRun: true });
    dispatchRunSessionCommand((draft) => setScreen(draft, ROUTE_SCREENS.DESTINATION));
    createContentSystemNavigation(
      makeDeps({ hasActiveRun: true, pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH }),
    ).beginLabyrinth();
    createContentSystemNavigation(
      makeDeps({ hasActiveRun: false, pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH }),
    ).handleCharacterSelect("knight");

    const getAvailableDestinations = vi.fn(() => [DESTINATIONS.NORMAL_COMBAT]);
    const resume = makeDeps({ hasActiveRun: true, getAvailableDestinations });
    createContentSystemNavigation(resume).beginCampaign();

    const onCommit = (resume.navigateTo as Mock).mock.calls[0]?.[1] as (() => void) | undefined;
    expect(onCommit).toEqual(expect.any(Function));
    onCommit?.();
    expect(getAvailableDestinations).toHaveBeenCalledWith({
      currentHealth: 12,
      currentGold: expect.any(Number),
      destinationIndexInAct: 2,
      maxHealth: 30,
    });
  });
});
