import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import * as config from "@/features/alchemy/shared/config";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/run-navigation-corruption";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { getRunAvailableDestinations } from "@/features/alchemy/shared/run-flow/destination-flow";
import { getPreviousDestination } from "@/features/alchemy/shared/run-flow/campaign-start";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import { makeTestCard } from "../../../../fixtures/cards";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { makeFlowHandlerDeps } from "../../../../helpers/run-flow-handler-deps";

beforeEach(() => {
  resetTransientRunUi();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("run destination controller actions", () => {
  it("selectRewardChoice updates reward selection through the handler", () => {
    getRunSessionStoreView().setRewardState(createEmptyRewardState());

    const handlers = createRunFlowHandlers(makeFlowHandlerDeps());
    handlers.selectRewardChoice("slash");
    expect(getRunSessionStoreView().rewardState.selectedId).toBe("slash");
  });

  it("prepareDestinationScreen sets boss id for boss-only destinations", () => {
    const mimicBoss = enemyBestiary.find((enemy) => enemy.id === "mimic")!;
    vi.spyOn(config, "getBossEnemy").mockReturnValue(mimicBoss);

    getRunSessionStoreView().setRewardState({
      ...createEmptyRewardState(),
      destinations: [CONSTANTS.DESTINATIONS.BOSS_COMBAT],
    });

    createRunFlowHandlers(makeFlowHandlerDeps()).prepareDestinationScreen();
    expect(getRunSessionStoreView().rewardState.selectedBossId).toBe("mimic");
  });

  it("continues from campfire through the progression handler", () => {
    const navigateTo = vi.fn();
    const handlers = createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo }));

    handlers.handleCampfireContinue();

    expect(getRunProgressStoreView().roomsEncountered).toBe(1);
    expect(navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.DESTINATION, expect.any(Function));
  });

  it("advanceToNextDestination samples the next picker at the live destination index after a non-combat continue", () => {
    const mimicBoss = enemyBestiary.find((enemy) => enemy.id === "mimic")!;
    vi.spyOn(config, "getBossEnemy").mockReturnValue(mimicBoss);
    setRunProgress({
      destinationIndexInAct: 7,
      completedDestinations: Array.from({ length: 7 }, () => CONSTANTS.DESTINATIONS.NORMAL_COMBAT),
    });

    const captured: Array<{ destinationIndexInAct?: number }> = [];
    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    const handlers = createRunFlowHandlers(
      makeFlowHandlerDeps({
        navigateTo,
        getAvailableDestinations: (opts) => {
          captured.push(opts ?? {});
          return [CONSTANTS.DESTINATIONS.BOSS_COMBAT];
        },
      }),
    );

    handlers.advanceToNextDestination();

    expect(captured.at(-1)?.destinationIndexInAct).toBe(7);
    expect(getRunSessionStoreView().rewardState.destinations).toEqual([CONSTANTS.DESTINATIONS.BOSS_COMBAT]);
  });

  it("advanceToNextDestination carries the live index so Corruption suppression applies after a non-combat continue", () => {
    setRunProgress({
      destinationIndexInAct: 2,
      completedDestinations: [CONSTANTS.DESTINATIONS.NORMAL_COMBAT, CONSTANTS.DESTINATIONS.CORRUPTION],
    });

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    const handlers = createRunFlowHandlers(
      makeFlowHandlerDeps({
        navigateTo,
        getAvailableDestinations: (opts) =>
          getRunAvailableDestinations({
            destinationIndexInAct: opts?.destinationIndexInAct ?? 0,
            currentHealth: 30,
            currentGold: 0,
            maxHealth: 30,
            hasAnyOwnedGear: true,
            previousDestination: getPreviousDestination(
              opts?.destinationIndexInAct ?? 0,
              getRunProgressStoreView().completedDestinations,
            ),
          }),
      }),
    );

    handlers.advanceToNextDestination();

    const offered = getRunSessionStoreView().rewardState.destinations;
    expect(offered.length).toBeGreaterThan(0);
    expect(offered).not.toContain(CONSTANTS.DESTINATIONS.CORRUPTION);
  });

  it.each([
    {
      name: "campaign",
      contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
      expectedScreen: CONSTANTS.SCREENS.DESTINATION,
      expectLabyrinthClear: false,
    },
    {
      name: "labyrinth",
      contentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH,
      expectedScreen: CONSTANTS.SCREENS.LABYRINTH_MAP,
      expectLabyrinthClear: true,
    },
  ])(
    "advanceToNextDestination clears leftover mystery visit state ($name)",
    ({ contentSystemType, expectedScreen, expectLabyrinthClear }) => {
      setRunProgress({ contentSystemType });
      const session = getRunSessionStoreView();
      session.setMysteryEvent({
        id: "stale-event",
        title: "Stale Event",
        art: "",
        narrative: "Should be cleared on continue.",
        choices: [{ label: "Leave", effects: [] }],
      });
      session.setMysteryCardChoices([
        { id: "slash", title: "Slash", descriptionLines: [""], art: "", cost: 1, effects: [] },
      ]);
      session.setMysteryGrantedTrinketIds(["bone-charm"]);
      session.setMysteryGrantedGearInstances([{ instanceId: "stale-gear", definitionId: "dagger-basic", affixes: [] }]);
      session.setMysteryChosenCardId("slash");
      session.setMysteryChosenChoice({ label: "Leave", effects: [] });
      session.setMysteryPendingRemoval(true);
      const stale = makeTestCard({ id: "slash" });
      session.setCorruptionResult({
        originalCard: stale,
        corruptedCard: { ...stale, corrupted: true },
        transformed: false,
        delta: -1,
      });

      const labyrinthClearNode = vi.fn();
      const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
      createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo, labyrinthClearNode })).advanceToNextDestination();

      const cleared = getRunSessionStoreView();
      expect(cleared.mysteryEvent).toBeNull();
      expect(cleared.mysteryCardChoices).toBeNull();
      expect(cleared.mysteryGrantedTrinketIds).toEqual([]);
      expect(cleared.mysteryGrantedGearInstances).toEqual([]);
      expect(cleared.mysteryChosenCardId).toBeNull();
      expect(cleared.mysteryChosenChoice).toBeNull();
      expect(cleared.mysteryPendingRemoval).toBe(false);
      expect(cleared.corruptionResult).toBeNull();
      expect(navigateTo.mock.calls[0]?.[0]).toBe(expectedScreen);
      if (expectLabyrinthClear) expect(labyrinthClearNode).toHaveBeenCalledOnce();
      else expect(labyrinthClearNode).not.toHaveBeenCalled();
    },
  );

  it("returnToCurrentDestination undoes a committed Corruption visit and restores the same picker", () => {
    const offered = [
      CONSTANTS.DESTINATIONS.CAMPFIRE,
      CONSTANTS.DESTINATIONS.CORRUPTION,
      CONSTANTS.DESTINATIONS.MYSTERY,
    ];
    setRunProgress({
      destinationIndexInAct: 2,
      roomsEncountered: 3,
      completedDestinations: [CONSTANTS.DESTINATIONS.NORMAL_COMBAT, CONSTANTS.DESTINATIONS.CORRUPTION],
      lastOfferedDestinations: offered,
      destinationRoundsSinceOffered: { [CONSTANTS.DESTINATIONS.CAMPFIRE]: 0 },
    });
    getRunSessionStoreView().setRewardState(createEmptyRewardState());

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo })).returnToCurrentDestination();

    expect(getRunProgressStoreView().roomsEncountered).toBe(3);
    expect(getRunProgressStoreView().destinationIndexInAct).toBe(1);
    expect(getRunProgressStoreView().completedDestinations).toEqual([CONSTANTS.DESTINATIONS.NORMAL_COMBAT]);
    expect(getRunProgressStoreView().destinationRoundsSinceOffered).toEqual({
      [CONSTANTS.DESTINATIONS.CAMPFIRE]: 0,
    });
    expect(getRunSessionStoreView().rewardState.destinations).toEqual(offered);
    expect(navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.DESTINATION, expect.any(Function));
  });

  it("returnToCurrentDestination cancels an uncommitted Corruption claim without advancing", () => {
    const offered = [
      CONSTANTS.DESTINATIONS.CAMPFIRE,
      CONSTANTS.DESTINATIONS.CORRUPTION,
      CONSTANTS.DESTINATIONS.MYSTERY,
    ];
    setRunProgress({
      destinationIndexInAct: 1,
      roomsEncountered: 3,
      completedDestinations: [CONSTANTS.DESTINATIONS.NORMAL_COMBAT],
      lastOfferedDestinations: offered,
    });
    const session = getRunSessionStoreView();
    session.setRewardState({ ...createEmptyRewardState(), destinations: offered });
    expect(session.beginDestinationClaim(CONSTANTS.DESTINATIONS.CORRUPTION)).toBe(true);

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo })).returnToCurrentDestination();

    expect(getRunSessionStoreView().pendingDestinationClaim).toBeNull();
    expect(getRunProgressStoreView().roomsEncountered).toBe(3);
    expect(getRunProgressStoreView().destinationIndexInAct).toBe(1);
    expect(getRunProgressStoreView().completedDestinations).toEqual([CONSTANTS.DESTINATIONS.NORMAL_COMBAT]);
    expect(getRunSessionStoreView().rewardState.destinations).toEqual(offered);
  });

  it("commitDestinationClaim seeds lastOfferedDestinations so Leave can restore an injected picker", () => {
    const offered = [CONSTANTS.DESTINATIONS.CORRUPTION];
    setRunProgress({
      destinationIndexInAct: 0,
      roomsEncountered: 0,
      completedDestinations: [],
      lastOfferedDestinations: [],
    });
    getRunSessionStoreView().setRewardState({ ...createEmptyRewardState(), destinations: offered });

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo })).handleDestinationChoice(
      CONSTANTS.DESTINATIONS.CORRUPTION,
    );

    expect(getRunProgressStoreView().lastOfferedDestinations).toEqual(offered);
    expect(getRunProgressStoreView().completedDestinations).toEqual([CONSTANTS.DESTINATIONS.CORRUPTION]);

    createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo })).returnToCurrentDestination();

    expect(getRunSessionStoreView().rewardState.destinations).toEqual(offered);
    expect(getRunProgressStoreView().destinationIndexInAct).toBe(0);
    expect(getRunProgressStoreView().completedDestinations).toEqual([]);
  });
});

describe("corruption destination exit", () => {
  it("handleCorruptionExit restores the current picker when no card was corrupted", () => {
    const advanceToNextDestination = vi.fn();
    const returnToCurrentDestination = vi.fn();
    createCorruptionFlowHandlers({
      getRunDeck: () => [],
      updateRunDeck: () => {},
      advanceToNextDestination,
      returnToCurrentDestination,
    }).handleCorruptionExit();

    expect(returnToCurrentDestination).toHaveBeenCalledOnce();
    expect(advanceToNextDestination).not.toHaveBeenCalled();
  });

  it("handleCorruptionExit advances after a corruption result", () => {
    const card = makeTestCard({ id: "slash" });
    getRunSessionStoreView().setCorruptionResult({
      originalCard: card,
      corruptedCard: { ...card, corrupted: true },
      transformed: false,
      delta: -1,
    });

    const advanceToNextDestination = vi.fn();
    const returnToCurrentDestination = vi.fn();
    createCorruptionFlowHandlers({
      getRunDeck: () => [],
      updateRunDeck: () => {},
      advanceToNextDestination,
      returnToCurrentDestination,
    }).handleCorruptionExit();

    expect(advanceToNextDestination).toHaveBeenCalledOnce();
    expect(returnToCurrentDestination).not.toHaveBeenCalled();
  });

  it("handleCorruptCard ignores a second pick after a result is stored", () => {
    const original = makeTestCard({ id: "slash" });
    const other = makeTestCard({ id: "block" });
    getRunSessionStoreView().setCorruptionResult({
      originalCard: original,
      corruptedCard: { ...original, corrupted: true },
      transformed: false,
      delta: -1,
    });

    const updateRunDeck = vi.fn();
    createCorruptionFlowHandlers({
      getRunDeck: () => [original, other],
      updateRunDeck,
      advanceToNextDestination: vi.fn(),
      returnToCurrentDestination: vi.fn(),
    }).handleCorruptCard(1);

    expect(updateRunDeck).not.toHaveBeenCalled();
  });
});
