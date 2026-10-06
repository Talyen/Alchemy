import "../../../../helpers/mock-audio";

import { setBattleActiveForTest, getBattleForTest } from "../../../../helpers/run-domain-store-test";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { resetAllTestStores } from "../../../../helpers/run-domain-store-test";
import { DEFAULT_CAMPAIGN_DIFFICULTY_ID, DRAFT_ROUNDS } from "@/lib/game-constants";
import { makeTestCard } from "../../../../fixtures/battle";
import { setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import {
  acceptCommand,
  dispatchGameplayCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/gameplay-command";
import { readActiveRun, readBattle, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { getStartingDeck } from "@/lib/game-data";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-state";
import { logError } from "@/lib/error-logger";
import { defaultGameSession } from "@/app/application-session";

vi.mock("@/lib/error-logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/error-logger")>()),
  logError: vi.fn(),
}));

beforeEach(() => {
  resetAllTestStores();
});

function makeDeps(overrides: Partial<Parameters<typeof createContentSystemNavigation>[0]> = {}) {
  const navigateTo = vi.fn();
  const resumeTo = vi.fn();
  const startBattle = vi.fn();
  return {
    navigateTo,
    resumeTo,
    startBattle,
    getAvailableDestinations: () => [DESTINATIONS.NORMAL_COMBAT],
    onResumeWildwood: vi.fn(),
    ...overrides,
  };
}

describe("createContentSystemNavigation", () => {
  it("beginCampaign routes to character select when no active run", () => {
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.beginCampaign();
    expect(readRunSession(defaultGameSession).pendingContentSystemType).toBe(CONTENT_SYSTEMS.CAMPAIGN);
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.CHARACTER_SELECT);
  });

  it("auto-starts the default battle for a hero new to the campaign", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.handleCharacterSelect("knight");
    expect(deps.startBattle).toHaveBeenCalledExactlyOnceWith({
      enemyType: "normal",
      modifiers: expect.any(Array),
      enemyId: "skeleton",
    });
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.BATTLE, expect.any(Function));
    expect(readActiveRun(defaultGameSession).contentSystemType).toBe(CONTENT_SYSTEMS.CAMPAIGN);
    expect(readActiveRun(defaultGameSession).characterId).toBe("knight");
  });

  it("sends a veteran hero to difficulty select", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    dispatchGameplayCommand(
      (draft) => {
        draft.profile.completedDifficulties.knight = [DEFAULT_CAMPAIGN_DIFFICULTY_ID];

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.handleCharacterSelect("knight");
    expect(deps.startBattle).not.toHaveBeenCalled();
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DIFFICULTY_SELECT);
    expect(readRunSession(defaultGameSession).pendingCharacterId).toBe("knight");
  });

  it("initializeLabyrinthRun creates enterable chambers before navigating to the map", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH });
    const deps = makeDeps({
      navigateTo: vi.fn(() => {
        const map = readRunSession(defaultGameSession).labyrinthMap;
        expect(map).not.toBeNull();
        expect(map && Object.keys(map.nodes).some((id) => canEnterLabyrinthNode(map, id))).toBe(true);
        expect(readRunSession(defaultGameSession).activity.kind).toBe("labyrinth-map");
      }),
    });
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.handleCharacterSelect("knight");
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.LABYRINTH_MAP);
    expect(readActiveRun(defaultGameSession).contentSystemType).toBe(CONTENT_SYSTEMS.LABYRINTH);
    const map = readRunSession(defaultGameSession).labyrinthMap;
    nav.beginLabyrinth();
    expect(readRunSession(defaultGameSession).labyrinthMap).toBe(map);
  });

  it("initializeWildwoodRun creates a resumable draft and navigates to draft deck", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.WILDWOOD });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.handleCharacterSelect("knight");
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DRAFT_DECK);
    expect(readActiveRun(defaultGameSession).contentSystemType).toBe(CONTENT_SYSTEMS.WILDWOOD);
    expect(readRunSession(defaultGameSession).activity.kind).toBe("draft-deck");
    expect(readActiveRun(defaultGameSession).runDeck).toEqual([]);
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(true);
    expect(readRunSession(defaultGameSession).wildwoodDraft?.draftChoices).toHaveLength(3);
  });

  it("returns to battle when resuming the same content system with an active battle", () => {
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    setRunSession({ hasActiveRun: true });
    dispatchGameplayCommand(
      (draft) => {
        setBattleActiveForTest(draft, true);

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.beginCampaign();
    expect(deps.resumeTo).toHaveBeenCalledWith(ROUTE_SCREENS.BATTLE);
  });

  it.each([CONTENT_SYSTEMS.CAMPAIGN, CONTENT_SYSTEMS.LABYRINTH, CONTENT_SYSTEMS.WILDWOOD])(
    "returns to the current %s battle",
    (mode) => {
      setRunProgress({ contentSystemType: mode, characterId: "knight" });
      setRunSession({ hasActiveRun: true });
      dispatchGameplayCommand(
        (draft) => {
          setBattleActiveForTest(draft, true);
          getBattleForTest(draft).battleState = makeTestBattleState({ turn: 4 });
          setScreen(draft, ROUTE_SCREENS.BATTLE);

          return acceptCommand();
        },
        undefined,
        defaultGameSession,
      );
      dispatchGameplayCommand(
        (draft) => acceptCommand(setScreen(draft, ROUTE_SCREENS.MENU)),
        undefined,
        defaultGameSession,
      );
      const deps = makeDeps();
      const nav = createContentSystemNavigation(deps, defaultGameSession);
      const begin = { campaign: nav.beginCampaign, labyrinth: nav.beginLabyrinth, wildwood: nav.beginWildwood };
      begin[mode]();
      expect(deps.resumeTo).toHaveBeenCalledWith(ROUTE_SCREENS.BATTLE);
      expect(deps.onResumeWildwood).not.toHaveBeenCalled();
      expect(readBattle(defaultGameSession).battleState.turn).toBe(4);
    },
  );

  it("initializeRunForDifficulty discovers starter deck on a fresh save", () => {
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    const knightStarterIds = getStartingDeck("knight").map((card) => card.id);

    nav.initializeRunForDifficulty("knight", DEFAULT_CAMPAIGN_DIFFICULTY_ID);

    expect(readProfileStore(defaultGameSession).discoveredCardIds).toEqual(knightStarterIds);
  });

  it("commits the initial destination offer and reward together", () => {
    setRunProgress({ runDeck: [] });
    const getAvailableDestinations = vi.fn(() => [DESTINATIONS.NORMAL_COMBAT]);
    const deps = makeDeps({
      getAvailableDestinations,
    });
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision), defaultGameSession);

    nav.initializeRunForDifficulty("knight", DEFAULT_CAMPAIGN_DIFFICULTY_ID);

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(getAvailableDestinations).toHaveBeenCalledWith({
      currentHealth: expect.any(Number),
      currentGold: expect.any(Number),
      destinationIndexInAct: 0,
      maxHealth: expect.any(Number),
    });
    expect(readRunSession(defaultGameSession).rewardFlow.state.destinations).toEqual([DESTINATIONS.NORMAL_COMBAT]);
    expect(readActiveRun(defaultGameSession).lastOfferedDestinations).toEqual([DESTINATIONS.NORMAL_COMBAT]);
  });

  it("initializeWildwoodRun does not discover the normal starter deck", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.WILDWOOD });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.handleCharacterSelect("knight");

    expect(readProfileStore(defaultGameSession).discoveredCardIds).toEqual([]);
  });

  it("starts a resumable campaign Wildcard draft with seeded choices", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.handleCharacterSelect("wildcard");
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DRAFT_DECK);
    expect(readRunSession(defaultGameSession).pendingCharacterId).toBe("wildcard");
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(true);
    expect(readActiveRun(defaultGameSession).characterId).toBe("wildcard");
    expect(readActiveRun(defaultGameSession).runDeck).toEqual([]);
    expect(readRunSession(defaultGameSession).activity.kind).toBe("draft-deck");
    expect(readRunSession(defaultGameSession).starterDraftChoices).toHaveLength(3);
  });

  it("starts a novice Wildcard campaign against Skeleton after the draft", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.handleCharacterSelect("wildcard");
    setRunSession({ activity: { kind: "draft-deck" } });
    dispatchGameplayCommand(
      (draft) => acceptCommand(setScreen(draft, ROUTE_SCREENS.DRAFT_DECK)),
      undefined,
      defaultGameSession,
    );
    for (let round = 0; round < DRAFT_ROUNDS; round += 1) {
      const choice = readRunSession(defaultGameSession).starterDraftChoices?.[0];
      expect(choice).toBeDefined();
      nav.handleStarterDraftPick(choice!.id);
    }

    nav.handleStandardDraftComplete();
    expect(() => nav.handleStandardDraftComplete()).not.toThrow();

    expect(deps.startBattle).toHaveBeenCalledExactlyOnceWith({
      enemyType: "normal",
      modifiers: expect.any(Array),
      enemyId: "skeleton",
    });
    expect(deps.navigateTo).toHaveBeenLastCalledWith(ROUTE_SCREENS.BATTLE, expect.any(Function));
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
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.CAMPAIGN, characterId: "wildcard" });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.beginCampaign();
    expect(deps.resumeTo).toHaveBeenCalledWith(ROUTE_SCREENS.DRAFT_DECK);
  });

  it("appends a starter-draft pick and rolls the next seeded choices", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.handleCharacterSelect("wildcard");
    const firstChoices = readRunSession(defaultGameSession).starterDraftChoices;
    expect(firstChoices).toHaveLength(3);
    const picked = firstChoices![0]!;
    nav.handleStarterDraftPick(picked.id);
    expect(readActiveRun(defaultGameSession).runDeck.map((card) => card.id)).toEqual([picked.id]);
    expect(readRunSession(defaultGameSession).starterDraftChoices).toHaveLength(3);
    expect(readRunSession(defaultGameSession).starterDraftChoices?.some((card) => card.id === picked.id)).toBe(false);
  });

  it("rejects starter-draft picks that are not in the current offer", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.handleCharacterSelect("wildcard");
    nav.handleStarterDraftPick("not-offered");
    expect(readActiveRun(defaultGameSession).runDeck).toEqual([]);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("handleStarterDraftPick"), expect.anything());
  });

  it("logs and returns when completing a draft without an active run", () => {
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.handleStandardDraftComplete();
    expect(deps.navigateTo).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("handleStandardDraftComplete"), expect.anything());
  });

  it("keeps an empty starter-draft offer after the final pick so labyrinth can resume to draft confirm", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.handleCharacterSelect("wildcard");
    for (let round = 0; round < DRAFT_ROUNDS; round += 1) {
      const choices = readRunSession(defaultGameSession).starterDraftChoices;
      expect(choices?.length).toBeGreaterThan(0);
      nav.handleStarterDraftPick(choices![0]!.id);
    }
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(DRAFT_ROUNDS);
    expect(readRunSession(defaultGameSession).starterDraftChoices).toEqual([]);
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
      pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH,
      starterDraftChoices: [],
    });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.beginLabyrinth();
    expect(deps.resumeTo).toHaveBeenCalledWith(ROUTE_SCREENS.DRAFT_DECK);
    setRunSession({ activity: { kind: "draft-deck" } });
    dispatchGameplayCommand(
      (draft) => acceptCommand(setScreen(draft, ROUTE_SCREENS.DRAFT_DECK)),
      undefined,
      defaultGameSession,
    );
    nav.handleStandardDraftComplete();
    expect(readRunSession(defaultGameSession).labyrinthMap).not.toBeNull();
    const map = readRunSession(defaultGameSession).labyrinthMap;
    expect(() => nav.handleStandardDraftComplete()).not.toThrow();
    expect(readRunSession(defaultGameSession).labyrinthMap).toBe(map);
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(drafted);
    expect(deps.navigateTo).toHaveBeenLastCalledWith(ROUTE_SCREENS.LABYRINTH_MAP);
    expect(deps.navigateTo).toHaveBeenCalledTimes(1);
  });

  it("resumes and completes a labyrinth Wildcard draft even if session pendingContentSystemType defaulted to campaign", () => {
    const drafted = Array.from({ length: DRAFT_ROUNDS }, (_, index) => makeTestCard({ id: `lab-draft-${index}` }));
    setRunProgress({
      characterId: "wildcard",
      contentSystemType: CONTENT_SYSTEMS.LABYRINTH,
      runDeck: drafted,
    });
    setRunSession({
      hasActiveRun: true,
      pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN,
      starterDraftChoices: [],
    });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    setRunSession({ activity: { kind: "draft-deck" } });
    dispatchGameplayCommand(
      (draft) => acceptCommand(setScreen(draft, ROUTE_SCREENS.DRAFT_DECK)),
      undefined,
      defaultGameSession,
    );
    nav.handleStandardDraftComplete();
    expect(readRunSession(defaultGameSession).labyrinthMap).not.toBeNull();
    expect(readActiveRun(defaultGameSession).contentSystemType).toBe(CONTENT_SYSTEMS.LABYRINTH);
    expect(deps.navigateTo).toHaveBeenLastCalledWith(ROUTE_SCREENS.LABYRINTH_MAP);
  });

  it("starts a veteran Wildcard campaign after returning from difficulty select to draft confirmation", () => {
    const draftedCards = Array.from({ length: DRAFT_ROUNDS }, (_, index) =>
      makeTestCard({ id: `campaign-draft-${index}` }),
    );
    // A veteran wildcard skips the novice auto-start and continues to difficulty select.
    dispatchGameplayCommand(
      (draft) => {
        draft.profile.completedDifficulties.wildcard = [DEFAULT_CAMPAIGN_DIFFICULTY_ID];

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    setRunProgress({
      characterId: "wildcard",
      contentSystemType: CONTENT_SYSTEMS.CAMPAIGN,
      runDeck: draftedCards,
      selectedDifficulty: null,
    });
    setRunSession({
      hasActiveRun: true,
      pendingCharacterId: "wildcard",
      pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN,
      starterDraftChoices: [],
    });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);

    setRunSession({ activity: { kind: "draft-deck" } });
    dispatchGameplayCommand(
      (draft) => acceptCommand(setScreen(draft, ROUTE_SCREENS.DRAFT_DECK)),
      undefined,
      defaultGameSession,
    );
    nav.handleStandardDraftComplete();
    expect(readRunSession(defaultGameSession).starterDraftChoices).toBeNull();
    expect(readRunSession(defaultGameSession).activity.kind).toBe("difficulty-select");
    expect(() => nav.handleStandardDraftComplete()).not.toThrow();
    expect(deps.navigateTo).toHaveBeenCalledExactlyOnceWith(ROUTE_SCREENS.DIFFICULTY_SELECT);
    dispatchGameplayCommand(
      (draft) => acceptCommand(setScreen(draft, ROUTE_SCREENS.DIFFICULTY_SELECT)),
      undefined,
      defaultGameSession,
    );
    nav.handleBackFromDifficultySelect();
    expect(readRunSession(defaultGameSession).activity.kind).toBe("draft-deck");
    dispatchGameplayCommand(
      (draft) => acceptCommand(setScreen(draft, ROUTE_SCREENS.DRAFT_DECK)),
      undefined,
      defaultGameSession,
    );
    nav.handleStandardDraftComplete();
    expect(readRunSession(defaultGameSession).activity.kind).toBe("difficulty-select");
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(draftedCards);
    expect(deps.startBattle).not.toHaveBeenCalled();
    dispatchGameplayCommand(
      (draft) => acceptCommand(setScreen(draft, ROUTE_SCREENS.DIFFICULTY_SELECT)),
      undefined,
      defaultGameSession,
    );
    nav.handleDifficultySelect(DEFAULT_CAMPAIGN_DIFFICULTY_ID);

    expect(readActiveRun(defaultGameSession).contentSystemType).toBe(CONTENT_SYSTEMS.CAMPAIGN);
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(draftedCards);
    expect(deps.startBattle).toHaveBeenCalledExactlyOnceWith({
      enemyType: "normal",
      modifiers: expect.any(Array),
    });
  });
  it("repairs missing Campaign destinations using the current run's progress without switching runs", () => {
    setRunProgress({
      contentSystemType: "campaign",
      characterId: "knight",
      destinationIndexInAct: 2,
      runPlayerHealth: 12,
      runMaxHealth: 30,
    });
    setRunSession({ hasActiveRun: true });
    dispatchGameplayCommand(
      (draft) => acceptCommand(setScreen(draft, ROUTE_SCREENS.DESTINATION)),
      undefined,
      defaultGameSession,
    );
    const getAvailableDestinations = vi.fn(() => [DESTINATIONS.NORMAL_COMBAT]);
    const deps = makeDeps({ getAvailableDestinations });
    createContentSystemNavigation(deps, defaultGameSession).resumeRun();
    const prepare = vi.mocked(deps.resumeTo).mock.calls[0]?.[1];
    expect(prepare).toBeTypeOf("function");
    prepare?.();
    expect(getAvailableDestinations).toHaveBeenCalledWith({
      currentHealth: 12,
      currentGold: expect.any(Number),
      destinationIndexInAct: 2,
      maxHealth: 30,
    });
  });
});
