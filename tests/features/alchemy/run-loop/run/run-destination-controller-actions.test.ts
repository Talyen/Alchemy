import { beforeEach, describe, expect, it, vi } from "vitest";
import * as config from "@/features/alchemy/shared/config";
import { createRunFlow } from "@/features/alchemy/run-loop/run/run-flow";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { getRunAvailableDestinations } from "@/features/alchemy/shared/run-flow/destination-flow";
import { getPreviousDestination } from "@/features/alchemy/shared/run-flow/resolve-available-destinations";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import {
  beginDestinationClaim,
  setMysteryCardChoices,
  setMysteryChosenCardId,
  setMysteryChosenChoice,
  setMysteryEvent,
  setMysteryGrantedGearInstances,
  setMysteryGrantedTrinketIds,
  setMysteryPendingRemoval,
  setRewardState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { makeFlowHandlerDeps } from "../../../../helpers/run-flow-handler-deps";
import { setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
beforeEach(() => {
  resetTransientRunUi();
});

describe("run destination controller actions", () => {
  it("claimRewardChoice rejects a choice that is not offered", () => {
    dispatchRunSessionCommand((draft) => setRewardState(draft, createEmptyRewardState()));

    const handlers = createRunFlow(makeFlowHandlerDeps());
    handlers.claimRewardChoice("slash");
    expect(readRunSession().rewardFlow.state.selectedId).toBeNull();
    expect(readRunSession().rewardFlow.claim.kind === "reward").toBe(false);
  });

  it("prepareDestinationScreen sets boss id for boss-only destinations", () => {
    vi.spyOn(config, "rollFreshBossId").mockReturnValue("mimic");

    dispatchRunSessionCommand((draft) =>
      setRewardState(draft, {
        ...createEmptyRewardState(),
        destinations: [DESTINATIONS.BOSS_COMBAT],
      }),
    );

    createRunFlow(makeFlowHandlerDeps()).prepareDestinationScreen();
    expect(readRunSession().rewardFlow.state.selectedBossId).toBe("mimic");
  });

  it("continues from campfire through the progression handler", () => {
    setRunSession({ activity: { kind: "campfire" } });
    let commit: (() => void) | undefined;
    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => {
      commit = onCommitted;
    });
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo }));

    handlers.handleCampfireContinue();

    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DESTINATION, expect.any(Function));
    expect(readActiveRun().roomsEncountered).toBe(0);

    commit?.();

    expect(readActiveRun().roomsEncountered).toBe(1);
  });

  it("advanceToNextDestination samples the next picker at the live destination index after a non-combat continue", () => {
    setRunSession({ activity: { kind: "campfire" } });
    vi.spyOn(config, "rollFreshBossId").mockReturnValue("mimic");
    setRunProgress({
      destinationIndexInAct: 7,
      completedDestinations: Array.from({ length: 7 }, () => DESTINATIONS.NORMAL_COMBAT),
    });

    const captured: Array<{ destinationIndexInAct?: number }> = [];
    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    const handlers = createRunFlow(
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
    expect(readRunSession().rewardFlow.state.destinations).toEqual([DESTINATIONS.BOSS_COMBAT]);
  });

  it("advanceToNextDestination carries the live index so Corruption suppression applies after a non-combat continue", () => {
    setRunSession({ activity: { kind: "campfire" } });
    setRunProgress({
      destinationIndexInAct: 2,
      completedDestinations: [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.CORRUPTION],
    });

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    const handlers = createRunFlow(
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
              readActiveRun().completedDestinations,
            ),
          }),
      }),
    );

    handlers.advanceToNextDestination();

    const offered = readRunSession().rewardFlow.state.destinations;
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
      dispatchRunSessionCommand((draft) => {
        setMysteryEvent(draft, {
          id: "stale-event",
          title: "Stale Event",
          art: "",
          narrative: "Should be cleared on continue.",
          choices: [{ label: "Leave", effects: [] }],
        });
        setMysteryCardChoices(draft, [
          { id: "slash", title: "Slash", descriptionLines: [""], art: "", cost: 1, effects: [] },
        ]);
        setMysteryGrantedTrinketIds(draft, ["bone-charm"]);
        setMysteryGrantedGearInstances(draft, [
          { instanceId: "stale-gear", definitionId: "dagger-basic", affixes: [] },
        ]);
        setMysteryChosenCardId(draft, "slash");
        setMysteryChosenChoice(draft, { label: "Leave", effects: [] });
        setMysteryPendingRemoval(draft, true);
      });

      const labyrinthClearNode = vi.fn();
      const navigateTo = vi.fn((_screen: string, prepare?: () => void) => prepare?.());
      const roomsBeforeExit = readActiveRun().roomsEncountered;
      createRunFlow(makeFlowHandlerDeps({ navigateTo, labyrinthClearNode })).advanceToNextDestination();
      expect(readRunSession().activity.kind).not.toBe("mystery");
      expect(readActiveRun().roomsEncountered).toBe(roomsBeforeExit + 1);
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
    dispatchRunSessionCommand((draft) => setRewardState(draft, createEmptyRewardState()));

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    createRunFlow(makeFlowHandlerDeps({ navigateTo })).returnToCurrentDestination();

    expect(readActiveRun().roomsEncountered).toBe(3);
    expect(readActiveRun().destinationIndexInAct).toBe(1);
    expect(readActiveRun().completedDestinations).toEqual([DESTINATIONS.NORMAL_COMBAT]);
    expect(readActiveRun().destinationRoundsSinceOffered).toEqual({
      [DESTINATIONS.CAMPFIRE]: 0,
    });
    expect(readRunSession().rewardFlow.state.destinations).toEqual(offered);
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
    dispatchRunSessionCommand((draft) => setRewardState(draft, { ...createEmptyRewardState(), destinations: offered }));
    expect(dispatchRunSessionCommand((draft) => beginDestinationClaim(draft, DESTINATIONS.CORRUPTION))).toBe(true);

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    createRunFlow(makeFlowHandlerDeps({ navigateTo })).returnToCurrentDestination();

    expect(readRunSession().rewardFlow.claim).toEqual({ kind: "idle" });
    expect(readActiveRun().roomsEncountered).toBe(3);
    expect(readActiveRun().destinationIndexInAct).toBe(1);
    expect(readActiveRun().completedDestinations).toEqual([DESTINATIONS.NORMAL_COMBAT]);
    expect(readRunSession().rewardFlow.state.destinations).toEqual(offered);
  });

  it("commitDestinationClaim seeds lastOfferedDestinations so Leave can restore an injected picker", () => {
    const offered = [DESTINATIONS.CORRUPTION];
    setRunProgress({
      destinationIndexInAct: 0,
      roomsEncountered: 0,
      completedDestinations: [],
      lastOfferedDestinations: [],
    });
    dispatchRunSessionCommand((draft) => setRewardState(draft, { ...createEmptyRewardState(), destinations: offered }));

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    createRunFlow(makeFlowHandlerDeps({ navigateTo })).handleDestinationChoice(DESTINATIONS.CORRUPTION);

    expect(readActiveRun().lastOfferedDestinations).toEqual(offered);
    expect(readActiveRun().completedDestinations).toEqual([DESTINATIONS.CORRUPTION]);

    createRunFlow(makeFlowHandlerDeps({ navigateTo })).returnToCurrentDestination();

    expect(readRunSession().rewardFlow.state.destinations).toEqual(offered);
    expect(readActiveRun().destinationIndexInAct).toBe(0);
    expect(readActiveRun().completedDestinations).toEqual([]);
  });
});
