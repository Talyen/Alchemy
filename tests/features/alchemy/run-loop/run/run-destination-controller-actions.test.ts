import { beforeEach, describe, expect, it, vi } from "vitest";
import * as config from "@/features/alchemy/shared/config";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/run-navigation-corruption";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { getRunAvailableDestinations } from "@/features/alchemy/shared/run-flow/destination-flow";
import { getPreviousDestination } from "@/features/alchemy/shared/run-flow/campaign-start";
import { makeTestCard } from "../../../../fixtures/cards";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { makeFlowHandlerDeps } from "../../../../helpers/run-flow-handler-deps";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";

beforeEach(() => {
  resetTransientRunUi();
});

describe("run destination controller actions", () => {
  it("selectRewardChoice updates reward selection through the handler", () => {
    getRunSessionStoreView().setRewardState(createEmptyRewardState());

    const handlers = createRunFlowHandlers(makeFlowHandlerDeps());
    handlers.selectRewardChoice("slash");
    expect(getRunSessionStoreView().rewardState.selectedId).toBe("slash");
  });

  it("prepareDestinationScreen sets boss id for boss-only destinations", () => {
    vi.spyOn(config, "rollFreshBossId").mockReturnValue("mimic");

    getRunSessionStoreView().setRewardState({
      ...createEmptyRewardState(),
      destinations: [DESTINATIONS.BOSS_COMBAT],
    });

    createRunFlowHandlers(makeFlowHandlerDeps()).prepareDestinationScreen();
    expect(getRunSessionStoreView().rewardState.selectedBossId).toBe("mimic");
  });

  it("continues from campfire through the progression handler", () => {
    let commit: (() => void) | undefined;
    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => {
      commit = onCommitted;
    });
    const handlers = createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo }));

    handlers.handleCampfireContinue();

    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DESTINATION, expect.any(Function));
    expect(getRunProgressStoreView().roomsEncountered).toBe(0);

    commit?.();

    expect(getRunProgressStoreView().roomsEncountered).toBe(1);
  });

  it("advanceToNextDestination samples the next picker at the live destination index after a non-combat continue", () => {
    vi.spyOn(config, "rollFreshBossId").mockReturnValue("mimic");
    setRunProgress({
      destinationIndexInAct: 7,
      completedDestinations: Array.from({ length: 7 }, () => DESTINATIONS.NORMAL_COMBAT),
    });

    const captured: Array<{ destinationIndexInAct?: number }> = [];
    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    const handlers = createRunFlowHandlers(
      makeFlowHandlerDeps({
        navigateTo,
        getAvailableDestinations: (opts) => {
          captured.push(opts ?? {});
          return [DESTINATIONS.BOSS_COMBAT];
        },
      }),
    );

    handlers.advanceToNextDestination();

    expect(captured.at(-1)?.destinationIndexInAct).toBe(7);
    expect(getRunSessionStoreView().rewardState.destinations).toEqual([DESTINATIONS.BOSS_COMBAT]);
  });

  it("advanceToNextDestination carries the live index so Corruption suppression applies after a non-combat continue", () => {
    setRunProgress({
      destinationIndexInAct: 2,
      completedDestinations: [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.CORRUPTION],
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
    expect(offered).not.toContain(DESTINATIONS.CORRUPTION);
  });

  it.each([
    {
      name: "campaign",
      contentSystemType: CONTENT_SYSTEMS.CAMPAIGN,
      expectedScreen: ROUTE_SCREENS.DESTINATION,
      expectLabyrinthClear: false,
    },
    {
      name: "labyrinth",
      contentSystemType: CONTENT_SYSTEMS.LABYRINTH,
      expectedScreen: ROUTE_SCREENS.LABYRINTH_MAP,
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
      session.setShopState({
        ...session.shopState,
        cards: [stale],
      });
      session.setAlchemistState({
        ...session.alchemistState,
        potions: [stale],
      });
      session.setCorruptionResult({
        originalCard: stale,
        corruptedCard: { ...stale, corrupted: true },
        transformed: false,
        delta: -1,
      });

      const labyrinthClearNode = vi.fn();
      let commit: (() => void) | undefined;
      const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => {
        commit = onCommitted;
      });
      const roomsBeforeExit = getRunProgressStoreView().roomsEncountered;
      createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo, labyrinthClearNode })).advanceToNextDestination();

      const outgoing = getRunSessionStoreView();
      expect(outgoing.mysteryEvent?.id).toBe("stale-event");
      expect(outgoing.shopState.cards).toEqual([stale]);
      expect(outgoing.alchemistState.potions).toEqual([stale]);
      expect(outgoing.corruptionResult?.originalCard.id).toBe("slash");
      expect(getRunProgressStoreView().roomsEncountered).toBe(roomsBeforeExit);
      expect(labyrinthClearNode).not.toHaveBeenCalled();

      commit?.();

      const cleared = getRunSessionStoreView();
      expect(cleared.mysteryEvent).toBeNull();
      expect(cleared.mysteryCardChoices).toBeNull();
      expect(cleared.mysteryGrantedTrinketIds).toEqual([]);
      expect(cleared.mysteryGrantedGearInstances).toEqual([]);
      expect(cleared.mysteryChosenCardId).toBeNull();
      expect(cleared.mysteryChosenChoice).toBeNull();
      expect(cleared.mysteryPendingRemoval).toBe(false);
      expect(cleared.corruptionResult).toBeNull();
      expect(cleared.shopState.cards).toEqual([]);
      expect(cleared.alchemistState.potions).toEqual([]);
      expect(cleared.trinketShopState.trinkets).toEqual([]);
      expect(cleared.equipmentShopState.gear).toEqual([]);
      expect(getRunProgressStoreView().roomsEncountered).toBe(roomsBeforeExit + 1);
      expect(navigateTo.mock.calls[0]?.[0]).toBe(expectedScreen);
      if (expectLabyrinthClear) expect(labyrinthClearNode).toHaveBeenCalledOnce();
      else expect(labyrinthClearNode).not.toHaveBeenCalled();
    },
  );

  it("returnToCurrentDestination undoes a committed Corruption visit and restores the same picker", () => {
    const offered = [DESTINATIONS.CAMPFIRE, DESTINATIONS.CORRUPTION, DESTINATIONS.MYSTERY];
    setRunProgress({
      destinationIndexInAct: 2,
      roomsEncountered: 3,
      completedDestinations: [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.CORRUPTION],
      lastOfferedDestinations: offered,
      destinationRoundsSinceOffered: { [DESTINATIONS.CAMPFIRE]: 0 },
    });
    getRunSessionStoreView().setRewardState(createEmptyRewardState());

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo })).returnToCurrentDestination();

    expect(getRunProgressStoreView().roomsEncountered).toBe(3);
    expect(getRunProgressStoreView().destinationIndexInAct).toBe(1);
    expect(getRunProgressStoreView().completedDestinations).toEqual([DESTINATIONS.NORMAL_COMBAT]);
    expect(getRunProgressStoreView().destinationRoundsSinceOffered).toEqual({
      [DESTINATIONS.CAMPFIRE]: 0,
    });
    expect(getRunSessionStoreView().rewardState.destinations).toEqual(offered);
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DESTINATION, expect.any(Function));
  });

  it("returnToCurrentDestination cancels an uncommitted Corruption claim without advancing", () => {
    const offered = [DESTINATIONS.CAMPFIRE, DESTINATIONS.CORRUPTION, DESTINATIONS.MYSTERY];
    setRunProgress({
      destinationIndexInAct: 1,
      roomsEncountered: 3,
      completedDestinations: [DESTINATIONS.NORMAL_COMBAT],
      lastOfferedDestinations: offered,
    });
    const session = getRunSessionStoreView();
    session.setRewardState({ ...createEmptyRewardState(), destinations: offered });
    expect(session.beginDestinationClaim(DESTINATIONS.CORRUPTION)).toBe(true);

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo })).returnToCurrentDestination();

    expect(getRunSessionStoreView().pendingDestinationClaim).toBeNull();
    expect(getRunProgressStoreView().roomsEncountered).toBe(3);
    expect(getRunProgressStoreView().destinationIndexInAct).toBe(1);
    expect(getRunProgressStoreView().completedDestinations).toEqual([DESTINATIONS.NORMAL_COMBAT]);
    expect(getRunSessionStoreView().rewardState.destinations).toEqual(offered);
  });

  it("commitDestinationClaim seeds lastOfferedDestinations so Leave can restore an injected picker", () => {
    const offered = [DESTINATIONS.CORRUPTION];
    setRunProgress({
      destinationIndexInAct: 0,
      roomsEncountered: 0,
      completedDestinations: [],
      lastOfferedDestinations: [],
    });
    getRunSessionStoreView().setRewardState({ ...createEmptyRewardState(), destinations: offered });

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo })).handleDestinationChoice(DESTINATIONS.CORRUPTION);

    expect(getRunProgressStoreView().lastOfferedDestinations).toEqual(offered);
    expect(getRunProgressStoreView().completedDestinations).toEqual([DESTINATIONS.CORRUPTION]);

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
      updateRunDeck: () => {},
      advanceToNextDestination,
      returnToCurrentDestination,
    }).handleCorruptionExit();

    expect(advanceToNextDestination).toHaveBeenCalledOnce();
    expect(returnToCurrentDestination).not.toHaveBeenCalled();
  });

  it("handleCorruptCard ignores a second pick after a result is stored", () => {
    const original = makeTestCard({ id: "slash" });
    getRunSessionStoreView().setCorruptionResult({
      originalCard: original,
      corruptedCard: { ...original, corrupted: true },
      transformed: false,
      delta: -1,
    });

    const updateRunDeck = vi.fn();
    createCorruptionFlowHandlers({
      updateRunDeck,
      advanceToNextDestination: vi.fn(),
      returnToCurrentDestination: vi.fn(),
    }).handleCorruptCard(1);

    expect(updateRunDeck).not.toHaveBeenCalled();
  });
});
