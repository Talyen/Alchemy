import { battleSnapshot } from "@/lib/battle";
import "../../../../helpers/mock-audio";
import {
  mutateGameplayForTest,
  setBattleActiveForTest,
  getBattleForTest,
  resetAllTestStores,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { DEFAULT_CAMPAIGN_DIFFICULTY_ID, DRAFT_ROUNDS } from "@/lib/game-constants";
import { makeTestCard } from "../../../../fixtures/battle";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/gameplay-command";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { getStartingDeck } from "@/lib/game-data";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-state";
import { logError } from "@/lib/error-logger";
import { createPlaythroughController } from "@/app/playthrough/controller";
import * as battleEngine from "@/lib/battle";
import { snapshotSessionSave } from "@/features/alchemy/shared/storage/session-persistence";
import { defaultGameSession } from "@/app/application-session";

vi.mock("@/lib/error-logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/error-logger")>()),
  logError: vi.fn(),
}));

beforeEach(() => {
  resetAllTestStores();
  mutateGameplayForTest((draft) => {
    draft.profile.finishedRunCharacters = ["knight", "rogue", "ranger", "wizard", "alchemist", "warlock", "druid"];
  });
});

function makeDeps(overrides: Partial<Parameters<typeof createContentSystemNavigation>[0]> = {}) {
  const navigateTo = vi.fn();
  const resumeTo = vi.fn();
  const presentBattleStart = vi.fn();
  return {
    navigateTo,
    resumeTo,
    presentBattleStart,
    onResumeWildwood: vi.fn(),
    ...overrides,
  };
}

describe("createContentSystemNavigation", () => {
  it("rejects a locked hero without starting a run or navigating", () => {
    mutateGameplayForTest((draft) => {
      draft.profile.finishedRunCharacters = [];
    });
    const deps = makeDeps();
    const before = snapshotSessionSave(defaultGameSession);
    createContentSystemNavigation(deps, defaultGameSession).handleCharacterSelect("rogue");
    expect(snapshotSessionSave(defaultGameSession)).toEqual(before);
    expect(deps.navigateTo).not.toHaveBeenCalled();
    expect(deps.presentBattleStart).not.toHaveBeenCalled();

    setRunSession({ pendingCharacterId: "rogue" });
    const pending = snapshotSessionSave(defaultGameSession);
    createContentSystemNavigation(deps, defaultGameSession).handleDifficultySelect(DEFAULT_CAMPAIGN_DIFFICULTY_ID);
    expect(snapshotSessionSave(defaultGameSession)).toEqual(pending);
    expect(deps.navigateTo).not.toHaveBeenCalled();
    expect(deps.presentBattleStart).not.toHaveBeenCalled();
  });

  it.each(["labyrinth", "wildwood"] as const)("rejects the locked %s mode at entry and hero selection", (mode) => {
    mutateGameplayForTest((draft) => {
      draft.profile.finishedRunCharacters = [];
    });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    const before = snapshotSessionSave(defaultGameSession);
    if (mode === "labyrinth") nav.beginLabyrinth();
    else nav.beginWildwood();
    expect(snapshotSessionSave(defaultGameSession)).toEqual(before);
    expect(deps.navigateTo).not.toHaveBeenCalled();

    setRunSession({ pendingContentSystemType: mode });
    const pending = snapshotSessionSave(defaultGameSession);
    nav.handleCharacterSelect("knight");
    expect(snapshotSessionSave(defaultGameSession)).toEqual(pending);
    expect(deps.navigateTo).not.toHaveBeenCalled();
  });

  it("a stale difficulty Back action preserves and resumes an active Wildcard battle", () => {
    setRunProgress({ characterId: "wildcard", runDeck: getStartingDeck("knight") });
    mutateGameplayForTest((draft) => {
      setBattleActiveForTest(draft, true);
      getBattleForTest(draft).battleState = battleSnapshot(makeTestBattleState({ turn: 4 }));
      setScreen(draft, ROUTE_SCREENS.BATTLE);
    });
    const before = snapshotSessionSave(defaultGameSession);
    const deps = makeDeps();
    createContentSystemNavigation(deps, defaultGameSession).handleBackFromDifficultySelect();
    expect(snapshotSessionSave(defaultGameSession)).toEqual(before);
    expect(readRunSession(defaultGameSession).activity.kind).toBe("battle");
    expect(deps.resumeTo).toHaveBeenCalledWith(ROUTE_SCREENS.BATTLE);
    expect(deps.navigateTo).not.toHaveBeenCalled();
  });

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
    expect(deps.presentBattleStart).toHaveBeenCalledOnce();
    expect(readBattle(defaultGameSession).battleState.currentEnemy.id).toBe("skeleton");
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.BATTLE);
    expect(readActiveRun(defaultGameSession).contentSystemType).toBe(CONTENT_SYSTEMS.CAMPAIGN);
    expect(readActiveRun(defaultGameSession).characterId).toBe("knight");
  });

  it.each(["novice", "difficulty"] as const)("rolls back the entire %s start when opening combat fails", (entry) => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN, pendingCharacterId: "knight" });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    const before = snapshotSessionSave(defaultGameSession);
    const commits = vi.fn();
    const unsubscribe = subscribeRunSessionCommits(commits, defaultGameSession);
    const resolve = battleEngine.resolveBattleStart;
    const failure = vi.spyOn(battleEngine, "resolveBattleStart").mockImplementationOnce((...args) => {
      resolve(...args);
      throw new Error("opening combat failed");
    });
    try {
      expect(() =>
        entry === "novice"
          ? nav.handleCharacterSelect("knight")
          : nav.handleDifficultySelect(DEFAULT_CAMPAIGN_DIFFICULTY_ID),
      ).toThrow("opening combat failed");
      expect(snapshotSessionSave(defaultGameSession)).toEqual(before);
      expect(commits).not.toHaveBeenCalled();
      expect(deps.navigateTo).not.toHaveBeenCalled();
      expect(deps.presentBattleStart).not.toHaveBeenCalled();
    } finally {
      failure.mockRestore();
      unsubscribe();
    }
  });

  it("publishes one complete start before feedback and lets opening outcomes supersede Battle", () => {
    setRunSession({ pendingCharacterId: "knight" });
    const deps = makeDeps();
    const observed: Array<ReturnType<typeof snapshotSessionSave>> = [];
    const unsubscribe = subscribeRunSessionCommits(
      () => observed.push(snapshotSessionSave(defaultGameSession)),
      defaultGameSession,
    );
    vi.mocked(deps.presentBattleStart).mockImplementation(() => {
      expect(readRunSession(defaultGameSession).pendingCharacterId).toBeNull();
      deps.navigateTo(ROUTE_SCREENS.REWARDS);
      throw new Error("presentation failed");
    });
    try {
      expect(() => createContentSystemNavigation(deps, defaultGameSession).handleCharacterSelect("knight")).toThrow(
        "presentation failed",
      );
      expect(observed).toHaveLength(1);
      expect(observed[0]?.activeRun?.activity.kind).toBe("battle");
      expect(observed[0]?.activeRun?.roomsEncountered).toBe(1);
      expect(snapshotSessionSave(defaultGameSession)).toEqual(observed[0]);
      expect(vi.mocked(deps.navigateTo).mock.calls.map(([screen]) => screen)).toEqual([
        ROUTE_SCREENS.BATTLE,
        ROUTE_SCREENS.REWARDS,
      ]);
    } finally {
      unsubscribe();
    }
  });

  it("keeps an opening Companion victory on Rewards through the production shell", () => {
    mutateGameplayForTest((draft) => {
      draft.runProfile.effects.companionDamage = 1000;
    });
    const resolve = battleEngine.resolveBattleStart;
    const opening = vi.spyOn(battleEngine, "resolveBattleStart").mockImplementationOnce((options, context) =>
      resolve(
        { ...options, difficultyModifiers: [{ kind: "start-companion", companionId: "bear" }] },
        // Fix the opening roll so the Companion lands the lethal hit.
        { ...context, rng: () => 0.99 },
      ),
    );
    try {
      const { flow } = createPlaythroughController(defaultGameSession);
      flow.goToScreen(ROUTE_SCREENS.GAME_MODE_SELECT);
      flow.beginCampaign();
      flow.handleCharacterSelect("knight");
      expect(readRunSession(defaultGameSession).activity.kind).toBe("rewards");
      expect(readActiveRunScreen(defaultGameSession)).toBe("rewards");
      expect(snapshotSessionSave(defaultGameSession).activeRun?.runHistory).toEqual([
        expect.objectContaining({ destination: DESTINATIONS.NORMAL_COMBAT, completed: true }),
      ]);
    } finally {
      opening.mockRestore();
    }
  });

  it("sends a veteran hero to difficulty select", () => {
    setRunSession({ pendingContentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    mutateGameplayForTest((draft) => {
      draft.profile.completedDifficulties.knight = [DEFAULT_CAMPAIGN_DIFFICULTY_ID];
    });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.handleCharacterSelect("knight");
    expect(deps.presentBattleStart).not.toHaveBeenCalled();
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
    mutateGameplayForTest((draft) => {
      setBattleActiveForTest(draft, true);
    });
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
      mutateGameplayForTest((draft) => {
        setBattleActiveForTest(draft, true);
        getBattleForTest(draft).battleState = battleSnapshot(makeTestBattleState({ turn: 4 }));
        setScreen(draft, ROUTE_SCREENS.BATTLE);
      });
      mutateGameplayForTest((draft) => setScreen(draft, ROUTE_SCREENS.MENU));
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
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision), defaultGameSession);

    nav.initializeRunForDifficulty("knight", DEFAULT_CAMPAIGN_DIFFICULTY_ID);

    unsubscribe();

    expect(commits).toHaveLength(1);
    const offers = readRunSession(defaultGameSession).rewardFlow.state.destinations;
    expect(offers).toHaveLength(3);
    expect(offers).not.toContain(DESTINATIONS.BOSS_COMBAT);
    expect(readActiveRun(defaultGameSession).lastOfferedDestinations).toEqual(offers);
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
    mutateGameplayForTest((draft) => setScreen(draft, ROUTE_SCREENS.DRAFT_DECK));
    for (let round = 0; round < DRAFT_ROUNDS; round += 1) {
      const choice = readRunSession(defaultGameSession).starterDraftChoices?.[0];
      expect(choice).toBeDefined();
      nav.handleStarterDraftPick(choice!.id);
    }

    nav.handleStandardDraftComplete();
    expect(() => nav.handleStandardDraftComplete()).not.toThrow();

    expect(deps.presentBattleStart).toHaveBeenCalledOnce();
    expect(readBattle(defaultGameSession).battleState.currentEnemy.id).toBe("skeleton");
    expect(deps.navigateTo).toHaveBeenLastCalledWith(ROUTE_SCREENS.BATTLE);
  });

  it("resumes an incomplete campaign Wildcard draft to the draft screen", () => {
    setRunProgress({ characterId: "wildcard", contentSystemType: CONTENT_SYSTEMS.CAMPAIGN, runDeck: [] });
    setRunSession({
      hasActiveRun: true,
      activity: { kind: "draft-deck" },
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
      activity: { kind: "draft-deck" },
      pendingContentSystemType: CONTENT_SYSTEMS.LABYRINTH,
      starterDraftChoices: [],
    });
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps, defaultGameSession);
    nav.beginLabyrinth();
    expect(deps.resumeTo).toHaveBeenCalledWith(ROUTE_SCREENS.DRAFT_DECK);
    setRunSession({ activity: { kind: "draft-deck" } });
    mutateGameplayForTest((draft) => setScreen(draft, ROUTE_SCREENS.DRAFT_DECK));
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
    mutateGameplayForTest((draft) => setScreen(draft, ROUTE_SCREENS.DRAFT_DECK));
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
    mutateGameplayForTest((draft) => {
      draft.profile.completedDifficulties.wildcard = [DEFAULT_CAMPAIGN_DIFFICULTY_ID];
    });
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
    mutateGameplayForTest((draft) => setScreen(draft, ROUTE_SCREENS.DRAFT_DECK));
    nav.handleStandardDraftComplete();
    expect(readRunSession(defaultGameSession).starterDraftChoices).toBeNull();
    expect(readRunSession(defaultGameSession).activity.kind).toBe("difficulty-select");
    expect(() => nav.handleStandardDraftComplete()).not.toThrow();
    expect(deps.navigateTo).toHaveBeenCalledExactlyOnceWith(ROUTE_SCREENS.DIFFICULTY_SELECT);
    mutateGameplayForTest((draft) => setScreen(draft, ROUTE_SCREENS.DIFFICULTY_SELECT));
    nav.handleBackFromDifficultySelect();
    expect(readRunSession(defaultGameSession).activity.kind).toBe("draft-deck");
    mutateGameplayForTest((draft) => setScreen(draft, ROUTE_SCREENS.DRAFT_DECK));
    nav.handleStandardDraftComplete();
    expect(readRunSession(defaultGameSession).activity.kind).toBe("difficulty-select");
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(draftedCards);
    expect(deps.presentBattleStart).not.toHaveBeenCalled();
    mutateGameplayForTest((draft) => setScreen(draft, ROUTE_SCREENS.DIFFICULTY_SELECT));
    nav.handleDifficultySelect(DEFAULT_CAMPAIGN_DIFFICULTY_ID);

    expect(readActiveRun(defaultGameSession).contentSystemType).toBe(CONTENT_SYSTEMS.CAMPAIGN);
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(draftedCards);
    expect(deps.presentBattleStart).toHaveBeenCalledOnce();
    expect(readRunSession(defaultGameSession).activity.kind).toBe("battle");
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
    mutateGameplayForTest((draft) => setScreen(draft, ROUTE_SCREENS.DESTINATION));
    const deps = makeDeps();
    createContentSystemNavigation(deps, defaultGameSession).resumeRun();
    expect(deps.resumeTo).toHaveBeenCalledWith(ROUTE_SCREENS.DESTINATION);
    expect(readRunSession(defaultGameSession).rewardFlow.state.destinations).toHaveLength(3);
    expect(readActiveRun(defaultGameSession)).toMatchObject({
      destinationIndexInAct: 2,
      runPlayerHealth: 12,
      runMaxHealth: 30,
    });
  });
});
