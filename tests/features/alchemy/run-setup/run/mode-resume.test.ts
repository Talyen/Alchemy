import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Screen } from "@/lib/routing";
import { DEFAULT_CAMPAIGN_DIFFICULTY_ID, DRAFT_ROUNDS } from "@/lib/game-constants";
import { getStartingDeck } from "@/lib/game-data";
import { createEmptyRewardState, emptyShopState } from "@/lib/active-run-session";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import {
  buildAlchemySaveDataFromStores,
  evaluateSaveCandidates,
  hydrateAlchemyPersistenceFields,
} from "@/features/alchemy/shared/storage";
import { restoreRun, snapshotRun, teardownRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setGold, setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  readActiveRunScreen,
  readParkedRuns,
  readRunProfile,
  readRunRecency,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { ANCIENT_ALTAR_MYSTERY_VISIT } from "../../shared/stores/active-run-data-fixture";

beforeEach(resetAllTestStores);

function createNavigation() {
  return createContentSystemNavigation({
    navigateTo: (screen: Screen, onCommit?: () => void) => {
      dispatchRunSessionCommand((draft) => setScreen(draft, screen));
      onCommit?.();
    },
    onStartBattle: vi.fn(),
    getAvailableDestinations: () => ["Normal Combat"],
    onResumeWildwood: vi.fn(),
    clearCardHover: vi.fn(),
  });
}

function startMode(nav: ReturnType<typeof createNavigation>, mode: ContentSystemId) {
  const begin = { campaign: nav.beginCampaign, labyrinth: nav.beginLabyrinth, wildwood: nav.beginWildwood };
  begin[mode]();
  if (mode === "campaign") {
    nav.initializeRunForDifficulty("knight", DEFAULT_CAMPAIGN_DIFFICULTY_ID);
    dispatchRunSessionCommand((draft) => setScreen(draft, "destination"));
  } else {
    nav.handleCharacterSelect("knight");
  }
}

function reloadSavedRuns() {
  const saved = buildAlchemySaveDataFromStores(readRunSession().hasActiveRun ? snapshotRun() : null);
  const loaded = evaluateSaveCandidates([JSON.stringify(saved)]);
  expect(loaded.status.kind).toBe("ok");
  resetAllTestStores();
  hydrateAlchemyPersistenceFields(loaded.data);
  const { activeRun, talentXP, unlockedTalents, parkedRuns, runRecency } = loaded.data;
  restoreRun(activeRun, talentXP, unlockedTalents, parkedRuns, runRecency);
}

describe("saved mode navigation", () => {
  it.each([
    ["labyrinth", "campaign"],
    ["campaign", "wildwood"],
    ["wildwood", "labyrinth"],
  ] as const)("preserves %s while browsing, starting, and ending %s", (first, second) => {
    const nav = createNavigation();
    startMode(nav, first);
    setRunProgress({ runPlayerHealth: 17, roomsEncountered: 3 });
    const firstRun = snapshotRun();
    dispatchRunSessionCommand((draft) => setScreen(draft, "game-mode-select"));
    const begin = { campaign: nav.beginCampaign, labyrinth: nav.beginLabyrinth, wildwood: nav.beginWildwood };
    begin[second]();
    expect(readActiveRunScreen()).toBe("character-select");
    expect(readRunSession().hasActiveRun).toBe(false);
    expect(readParkedRuns()[first]).toEqual(firstRun);
    expect(readRunRecency()).toEqual([first]);
    dispatchRunSessionCommand((draft) => setScreen(draft, "game-mode-select"));
    nav.resumeRun();
    expect(snapshotRun()).toEqual(firstRun);

    dispatchRunSessionCommand((draft) => setScreen(draft, "game-mode-select"));
    startMode(nav, second);
    setRunProgress({ runPlayerHealth: 23, roomsEncountered: 1 });
    const secondRun = snapshotRun();
    dispatchRunSessionCommand((draft) => setGold(draft, 73));
    reloadSavedRuns();
    expect(readActiveRunScreen()).toBe(secondRun.currentScreen);
    expect(snapshotRun()).toEqual(secondRun);
    expect(readParkedRuns()[first]).toEqual(firstRun);
    nav.resumeRun(first);
    expect(readActiveRunScreen()).toBe(firstRun.currentScreen);
    expect(snapshotRun()).toEqual(firstRun);
    expect(readRunProfile().gold).toBe(73);
    nav.resumeRun(second);
    expect(snapshotRun()).toEqual(secondRun);
    teardownRun();
    expect(readParkedRuns()[first]).toEqual(firstRun);
    expect(readParkedRuns()[second]).toBeUndefined();
    reloadSavedRuns();
    nav.resumeRun();
    expect(snapshotRun()).toEqual(firstRun);
    expect(readRunRecency()).toEqual([first]);
  });

  it("preserves the final Wildcard draft confirmation through mode switching and reload", () => {
    const nav = createNavigation();
    nav.beginLabyrinth();
    nav.handleCharacterSelect("wildcard");
    setRunProgress({ runDeck: Array.from({ length: DRAFT_ROUNDS }, () => getStartingDeck("knight")[0]!) });
    setRunSession({ starterDraftChoices: [] });
    dispatchRunSessionCommand((draft) => setScreen(draft, "menu"));
    nav.beginCampaign();
    reloadSavedRuns();
    nav.resumeRun();
    expect(readActiveRunScreen()).toBe("draft-deck");
    expect(readRunSession().starterDraftChoices).toEqual([]);
    nav.handleStandardDraftComplete();
    expect(readActiveRunScreen()).toBe("labyrinth-map");
    expect(readRunSession().labyrinthMap).not.toBeNull();
  });

  it.each(["shop", "rewards", "mystery", "corruption"] as const)(
    "returns to the unfinished %s after menu navigation, mode switching, and reload",
    (screen) => {
      const nav = createNavigation();
      startMode(nav, "labyrinth");
      const card = getStartingDeck("knight")[0]!;
      restoreRun(
        {
          ...snapshotRun(),
          currentScreen: screen,
          shopState:
            screen === "shop"
              ? { ...emptyShopState(), cards: [card], removeUsed: true, firstPurchaseUsed: true, refreshesLeft: 1 }
              : null,
          mysteryVisit: screen === "mystery" ? ANCIENT_ALTAR_MYSTERY_VISIT : null,
          corruptionResult:
            screen === "corruption"
              ? { originalCard: card, corruptedCard: { ...card, cost: 0 }, delta: -1, transformed: false }
              : null,
        },
        {},
        {},
      );
      if (screen === "rewards") {
        setRunSession({ rewardState: { ...createEmptyRewardState(), choices: [card], gold: 7 } });
      }
      const checkpoint = snapshotRun();
      dispatchRunSessionCommand((draft) => setScreen(draft, "menu"));
      expect(snapshotRun()).toEqual(checkpoint);
      nav.beginCampaign();
      reloadSavedRuns();
      const profile = readRunProfile();
      nav.resumeRun();
      expect(readActiveRunScreen()).toBe(screen);
      expect(snapshotRun()).toEqual(checkpoint);
      expect(readRunProfile()).toEqual(profile);
    },
  );

  it("recovers a parked Labyrinth snapshot that recorded the game-mode menu", () => {
    const nav = createNavigation();
    startMode(nav, "labyrinth");
    const checkpoint = snapshotRun();
    restoreRun(null, {}, {}, { labyrinth: { ...checkpoint, currentScreen: "game-mode-select" } }, ["labyrinth"]);
    nav.resumeRun();
    expect(readActiveRunScreen()).toBe("labyrinth-map");
    expect(snapshotRun()).toEqual(checkpoint);
  });
});
