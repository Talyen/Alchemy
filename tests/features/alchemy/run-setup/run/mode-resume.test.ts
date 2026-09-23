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
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRunScreen, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { ANCIENT_ALTAR_MYSTERY_VISIT } from "../../shared/stores/active-run-data-fixture";

beforeEach(resetAllTestStores);

function createNavigation(onStartBattle = vi.fn()) {
  const navigateTo = (screen: Screen, onCommit?: () => void) => {
    dispatchRunSessionCommand((draft) => setScreen(draft, screen));
    onCommit?.();
  };
  return createContentSystemNavigation({
    navigateTo,
    resumeTo: navigateTo,
    onStartBattle,
    getAvailableDestinations: () => ["Normal Combat"],
    onResumeWildwood: vi.fn(),
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
  const { activeRun, talentXP, unlockedTalents } = loaded.data;
  restoreRun(activeRun, talentXP, unlockedTalents);
}

describe("saved mode navigation", () => {
  it.each(["campaign", "labyrinth", "wildwood"] as const)(
    "keeps the sole %s run when another mode is requested",
    (mode) => {
      const nav = createNavigation();
      startMode(nav, mode);
      const checkpoint = snapshotRun();
      dispatchRunSessionCommand((draft) => setScreen(draft, "menu"));
      nav.beginCampaign();
      nav.handleCharacterSelect("rogue");
      expect(snapshotRun()).toEqual(checkpoint);
      reloadSavedRuns();
      expect(snapshotRun()).toEqual(checkpoint);
    },
  );

  it("preserves the final Wildcard draft confirmation through attempted mode switching and reload", () => {
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

  it("keeps a completed Campaign Wildcard draft at confirmation after reload", () => {
    const onStartBattle = vi.fn();
    const nav = createNavigation(onStartBattle);
    nav.beginCampaign();
    nav.handleCharacterSelect("wildcard");
    for (let round = 0; round < DRAFT_ROUNDS; round += 1) {
      const choice = readRunSession().starterDraftChoices?.[0];
      expect(choice).toBeDefined();
      nav.handleStarterDraftPick(choice!.id);
    }
    expect(readRunSession().starterDraftChoices).toEqual([]);

    dispatchRunSessionCommand((draft) => setScreen(draft, "menu"));
    nav.handleStandardDraftComplete();
    expect(onStartBattle).not.toHaveBeenCalled();
    reloadSavedRuns();
    nav.resumeRun();

    expect(readActiveRunScreen()).toBe("draft-deck");
    expect(readRunSession().starterDraftChoices).toEqual([]);
    nav.handleStandardDraftComplete();
    expect(onStartBattle).toHaveBeenCalledExactlyOnceWith(
      expect.any(Array),
      expect.any(Number),
      "normal",
      expect.any(Array),
      "skeleton",
    );
    expect(readActiveRunScreen()).toBe("battle");
    expect(readRunSession().starterDraftChoices).toBeNull();
  });

  it("sends a veteran Campaign Wildcard to Difficulty Select only after confirming a reloaded draft", () => {
    dispatchRunSessionCommand((draft) => {
      draft.profile.completedDifficulties.wildcard = [DEFAULT_CAMPAIGN_DIFFICULTY_ID];
    });
    const onStartBattle = vi.fn();
    const nav = createNavigation(onStartBattle);
    nav.beginCampaign();
    nav.handleCharacterSelect("wildcard");
    for (let round = 0; round < DRAFT_ROUNDS; round += 1) {
      const choice = readRunSession().starterDraftChoices?.[0];
      expect(choice).toBeDefined();
      nav.handleStarterDraftPick(choice!.id);
    }

    dispatchRunSessionCommand((draft) => setScreen(draft, "menu"));
    reloadSavedRuns();
    nav.resumeRun();
    expect(readActiveRunScreen()).toBe("draft-deck");

    nav.handleStandardDraftComplete();
    expect(readActiveRunScreen()).toBe("difficulty-select");
    expect(readRunSession().starterDraftChoices).toBeNull();
    expect(onStartBattle).not.toHaveBeenCalled();
  });

  it.each(["shop", "rewards", "mystery", "corruption"] as const)(
    "returns to the unfinished %s after menu navigation, attempted mode switching, and reload",
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
});
