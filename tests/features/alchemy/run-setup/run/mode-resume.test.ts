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
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRunScreen, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { ANCIENT_ALTAR_MYSTERY_VISIT } from "../../shared/stores/active-run-data-fixture";
import { defaultGameSession } from "@/app/application-session";
import { savedActivityFixture } from "../../../../fixtures/run-activity";

beforeEach(resetAllTestStores);

function createNavigation(startBattle = vi.fn()) {
  const navigateTo = (screen: Screen, onCommit?: () => void) => {
    dispatchGameplayCommand((draft) => acceptCommand(setScreen(draft, screen)), undefined, defaultGameSession);
    onCommit?.();
  };
  return createContentSystemNavigation(
    {
      navigateTo,
      resumeTo: navigateTo,
      startBattle,
      getAvailableDestinations: () => ["Normal Combat"],
      onResumeWildwood: vi.fn(),
    },
    defaultGameSession,
  );
}

function startMode(nav: ReturnType<typeof createNavigation>, mode: ContentSystemId) {
  const begin = { campaign: nav.beginCampaign, labyrinth: nav.beginLabyrinth, wildwood: nav.beginWildwood };
  begin[mode]();
  if (mode === "campaign") {
    nav.initializeRunForDifficulty("knight", DEFAULT_CAMPAIGN_DIFFICULTY_ID);
    dispatchGameplayCommand((draft) => acceptCommand(setScreen(draft, "destination")), undefined, defaultGameSession);
  } else {
    nav.handleCharacterSelect("knight");
  }
}

function reloadSavedRuns() {
  const saved = buildAlchemySaveDataFromStores(
    readRunSession(defaultGameSession).hasActiveRun ? snapshotRun(defaultGameSession) : null,
    defaultGameSession,
  );
  const loaded = evaluateSaveCandidates([JSON.stringify(saved)]);
  expect(loaded.status.kind).toBe("ok");
  resetAllTestStores();
  hydrateAlchemyPersistenceFields(loaded.data, defaultGameSession);
  const { activeRun, talentXP, unlockedTalents } = loaded.data;
  restoreRun(activeRun, talentXP, unlockedTalents, defaultGameSession);
}

describe("saved mode navigation", () => {
  it.each(["campaign", "labyrinth", "wildwood"] as const)(
    "keeps the sole %s run when another mode is requested",
    (mode) => {
      const nav = createNavigation();
      startMode(nav, mode);
      const checkpoint = snapshotRun(defaultGameSession);
      dispatchGameplayCommand((draft) => acceptCommand(setScreen(draft, "menu")), undefined, defaultGameSession);
      nav.beginCampaign();
      nav.handleCharacterSelect("rogue");
      expect(snapshotRun(defaultGameSession)).toEqual(checkpoint);
      reloadSavedRuns();
      expect(snapshotRun(defaultGameSession)).toEqual(checkpoint);
    },
  );

  it("preserves the final Wildcard draft confirmation through attempted mode switching and reload", () => {
    const nav = createNavigation();
    nav.beginLabyrinth();
    nav.handleCharacterSelect("wildcard");
    setRunProgress({ runDeck: Array.from({ length: DRAFT_ROUNDS }, () => getStartingDeck("knight")[0]!) });
    setRunSession({ starterDraftChoices: [] });
    dispatchGameplayCommand((draft) => acceptCommand(setScreen(draft, "menu")), undefined, defaultGameSession);
    nav.beginCampaign();
    reloadSavedRuns();
    nav.resumeRun();
    expect(readActiveRunScreen(defaultGameSession)).toBe("draft-deck");
    expect(readRunSession(defaultGameSession).starterDraftChoices).toEqual([]);
    nav.handleStandardDraftComplete();
    expect(readActiveRunScreen(defaultGameSession)).toBe("labyrinth-map");
    expect(readRunSession(defaultGameSession).labyrinthMap).not.toBeNull();
  });

  it("keeps a completed Campaign Wildcard draft at confirmation after reload", () => {
    const startBattle = vi.fn();
    const nav = createNavigation(startBattle);
    nav.beginCampaign();
    nav.handleCharacterSelect("wildcard");
    for (let round = 0; round < DRAFT_ROUNDS; round += 1) {
      const choice = readRunSession(defaultGameSession).starterDraftChoices?.[0];
      expect(choice).toBeDefined();
      nav.handleStarterDraftPick(choice!.id);
    }
    expect(readRunSession(defaultGameSession).starterDraftChoices).toEqual([]);

    dispatchGameplayCommand((draft) => acceptCommand(setScreen(draft, "menu")), undefined, defaultGameSession);
    nav.handleStandardDraftComplete();
    expect(startBattle).not.toHaveBeenCalled();
    reloadSavedRuns();
    nav.resumeRun();

    expect(readActiveRunScreen(defaultGameSession)).toBe("draft-deck");
    expect(readRunSession(defaultGameSession).starterDraftChoices).toEqual([]);
    nav.handleStandardDraftComplete();
    expect(startBattle).toHaveBeenCalledExactlyOnceWith({
      enemyType: "normal",
      modifiers: expect.any(Array),
      enemyId: "skeleton",
    });
    expect(readActiveRunScreen(defaultGameSession)).toBe("battle");
    expect(readRunSession(defaultGameSession).starterDraftChoices).toBeNull();
  });

  it("sends a veteran Campaign Wildcard to Difficulty Select only after confirming a reloaded draft", () => {
    dispatchGameplayCommand(
      (draft) => {
        draft.profile.completedDifficulties.wildcard = [DEFAULT_CAMPAIGN_DIFFICULTY_ID];

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    const startBattle = vi.fn();
    const nav = createNavigation(startBattle);
    nav.beginCampaign();
    nav.handleCharacterSelect("wildcard");
    for (let round = 0; round < DRAFT_ROUNDS; round += 1) {
      const choice = readRunSession(defaultGameSession).starterDraftChoices?.[0];
      expect(choice).toBeDefined();
      nav.handleStarterDraftPick(choice!.id);
    }

    dispatchGameplayCommand((draft) => acceptCommand(setScreen(draft, "menu")), undefined, defaultGameSession);
    reloadSavedRuns();
    nav.resumeRun();
    expect(readActiveRunScreen(defaultGameSession)).toBe("draft-deck");

    nav.handleStandardDraftComplete();
    expect(readActiveRunScreen(defaultGameSession)).toBe("difficulty-select");
    expect(readRunSession(defaultGameSession).starterDraftChoices).toBeNull();
    expect(startBattle).not.toHaveBeenCalled();
  });

  it.each(["shop", "rewards", "mystery", "corruption"] as const)(
    "returns to the unfinished %s after menu navigation, attempted mode switching, and reload",
    (screen) => {
      const nav = createNavigation();
      startMode(nav, "labyrinth");
      const card = getStartingDeck("knight")[0]!;
      restoreRun(
        {
          ...snapshotRun(defaultGameSession),
          activity: savedActivityFixture(
            screen,
            screen === "shop"
              ? { ...emptyShopState(), cards: [card], removeUsed: true, firstPurchaseUsed: true, refreshesLeft: 1 }
              : screen === "mystery"
                ? ANCIENT_ALTAR_MYSTERY_VISIT
                : undefined,
          ),
        },
        {},
        {},
        defaultGameSession,
      );
      if (screen === "rewards") {
        setRunSession({ rewardState: { ...createEmptyRewardState(), choices: [card], gold: 7 } });
      }
      const checkpoint = snapshotRun(defaultGameSession);
      dispatchGameplayCommand((draft) => acceptCommand(setScreen(draft, "menu")), undefined, defaultGameSession);
      expect(snapshotRun(defaultGameSession)).toEqual(checkpoint);
      nav.beginCampaign();
      reloadSavedRuns();
      const profile = readRunProfile(defaultGameSession);
      nav.resumeRun();
      expect(readActiveRunScreen(defaultGameSession)).toBe(screen);
      expect(snapshotRun(defaultGameSession)).toEqual(checkpoint);
      expect(readRunProfile(defaultGameSession)).toEqual(profile);
    },
  );
});
