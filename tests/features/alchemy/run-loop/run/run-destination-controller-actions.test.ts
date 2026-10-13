import { emptyAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as config from "@/features/alchemy/shared/config";
import { createRunFlow } from "@/features/alchemy/run-loop/run/run-flow";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import {
  setMysteryCardChoices,
  setMysteryChosenCardId,
  setMysteryChosenChoice,
  setMysteryEvent,
  setMysteryGrantedGearInstances,
  setMysteryGrantedTrinketIds,
  setRewardState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { makeFlowHandlerDeps } from "../../../../helpers/run-flow-handler-deps";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { defaultGameSession } from "@/app/application-session";
beforeEach(() => {
  resetAllTestStores();
});

describe("run destination controller actions", () => {
  it.each([CONTENT_SYSTEMS.CAMPAIGN, CONTENT_SYSTEMS.LABYRINTH])(
    "continues or leaves Transmutation without trapping a %s run",
    (contentSystemType) => {
      setRunProgress({ contentSystemType });
      setRunSession({ activity: { kind: "transmutation", data: emptyAlchemyVisit() } });
      const navigateTo = vi.fn((_screen: string, prepare?: () => void) => prepare?.());
      const rooms = readActiveRun(defaultGameSession).roomsEncountered;
      createRunFlow(makeFlowHandlerDeps({ navigateTo }), defaultGameSession).advanceToNextDestination("transmutation");
      expect(navigateTo).toHaveBeenCalledWith(
        contentSystemType === CONTENT_SYSTEMS.LABYRINTH ? ROUTE_SCREENS.LABYRINTH_MAP : ROUTE_SCREENS.DESTINATION,
      );
      expect(readActiveRun(defaultGameSession).roomsEncountered).toBe(rooms + 1);
      expect(readRunSession(defaultGameSession).activity.kind).toBe(
        contentSystemType === CONTENT_SYSTEMS.LABYRINTH ? "labyrinth-map" : "destination",
      );
    },
  );

  it("claimRewardChoice rejects a choice that is not offered", () => {
    dispatchRunSessionCommand(
      (draft) => acceptCommand(setRewardState(draft, createEmptyRewardState())),
      undefined,
      defaultGameSession,
    );

    const handlers = createRunFlow(makeFlowHandlerDeps(), defaultGameSession);
    handlers.claimRewardChoice("slash");
    expect(readRunSession(defaultGameSession).rewardFlow.state.selectedId).toBeNull();
    expect(readRunSession(defaultGameSession).rewardFlow.claim.kind === "reward").toBe(false);
  });

  it("prepareDestinationScreen sets boss id for boss-only destinations", () => {
    vi.spyOn(config, "rollFreshBossId").mockReturnValue("mimic");

    dispatchRunSessionCommand(
      (draft) =>
        acceptCommand(
          setRewardState(draft, {
            ...createEmptyRewardState(),
            destinations: [DESTINATIONS.BOSS_COMBAT],
          }),
        ),
      undefined,
      defaultGameSession,
    );

    setRunSession({ activity: { kind: "destination" } });
    createRunFlow(makeFlowHandlerDeps(), defaultGameSession).prepareDestinationScreen();
    expect(readRunSession(defaultGameSession).rewardFlow.state.selectedBossId).toBe("mimic");
  });

  it("continues from campfire through the progression handler", () => {
    setRunSession({ activity: { kind: "campfire", data: emptyAlchemyVisit() } });
    let commit: (() => void) | undefined;
    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => {
      commit = onCommitted;
    });
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo }), defaultGameSession);

    handlers.handleCampfireContinue();

    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DESTINATION);
    expect(readActiveRun(defaultGameSession).roomsEncountered).toBe(1);

    commit?.();

    expect(readActiveRun(defaultGameSession).roomsEncountered).toBe(1);
    expect(readRunSession(defaultGameSession).activity.kind).toBe("destination");
  });

  it("advanceToNextDestination samples the next picker at the live destination index after a non-combat continue", () => {
    setRunSession({ activity: { kind: "campfire", data: emptyAlchemyVisit() } });
    vi.spyOn(config, "rollFreshBossId").mockReturnValue("mimic");
    setRunProgress({
      destinationIndexInAct: 7,
      completedDestinations: Array.from({ length: 7 }, () => DESTINATIONS.NORMAL_COMBAT),
    });

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo }), defaultGameSession);

    handlers.advanceToNextDestination("campfire");

    expect(readRunSession(defaultGameSession).rewardFlow.state.destinations).toEqual([DESTINATIONS.BOSS_COMBAT]);
  });

  it("advanceToNextDestination carries the live index so Corruption suppression applies after a non-combat continue", () => {
    setRunSession({ activity: { kind: "campfire", data: emptyAlchemyVisit() } });
    setRunProgress({
      destinationIndexInAct: 2,
      completedDestinations: [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.CORRUPTION],
    });

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo }), defaultGameSession);

    handlers.advanceToNextDestination("campfire");

    const offered = readRunSession(defaultGameSession).rewardFlow.state.destinations;
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
    ({ contentSystemType, expectedScreen }) => {
      setRunProgress({ contentSystemType });
      dispatchRunSessionCommand(
        (draft) => {
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
          setMysteryCardChoices(draft, null);
          setMysteryChosenChoice(draft, { label: "Leave", effects: [] });

          return acceptCommand();
        },
        undefined,
        defaultGameSession,
      );

      const navigateTo = vi.fn((_screen: string, prepare?: () => void) => prepare?.());
      const roomsBeforeExit = readActiveRun(defaultGameSession).roomsEncountered;
      createRunFlow(makeFlowHandlerDeps({ navigateTo }), defaultGameSession).advanceToNextDestination("mystery");
      expect(readRunSession(defaultGameSession).activity.kind).not.toBe("mystery");
      expect(readActiveRun(defaultGameSession).roomsEncountered).toBe(roomsBeforeExit + 1);
      expect(navigateTo.mock.calls[0]?.[0]).toBe(expectedScreen);
    },
  );

  it("leaving untouched Corruption restores the same picker without consuming the room", () => {
    const offered = [DESTINATIONS.CAMPFIRE, DESTINATIONS.CORRUPTION, DESTINATIONS.MYSTERY];
    setRunProgress({
      destinationIndexInAct: 2,
      roomsEncountered: 3,
      completedDestinations: [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.CORRUPTION],
      lastOfferedDestinations: offered,
      destinationRoundsSinceOffered: { [DESTINATIONS.CAMPFIRE]: 0 },
    });
    dispatchRunSessionCommand(
      (draft) => acceptCommand(setRewardState(draft, createEmptyRewardState())),
      undefined,
      defaultGameSession,
    );

    setRunSession({ activity: { kind: "corruption", data: null } });
    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    createRunFlow(makeFlowHandlerDeps({ navigateTo }), defaultGameSession).advanceToNextDestination("corruption");

    expect(readActiveRun(defaultGameSession).roomsEncountered).toBe(3);
    expect(readActiveRun(defaultGameSession).destinationIndexInAct).toBe(1);
    expect(readActiveRun(defaultGameSession).completedDestinations).toEqual([DESTINATIONS.NORMAL_COMBAT]);
    expect(readActiveRun(defaultGameSession).destinationRoundsSinceOffered).toEqual({
      [DESTINATIONS.CAMPFIRE]: 0,
    });
    expect(readRunSession(defaultGameSession).rewardFlow.state.destinations).toEqual(offered);
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DESTINATION);
  });

  it("commitDestinationClaim seeds lastOfferedDestinations so Leave can restore an injected picker", () => {
    setRunSession({ activity: { kind: "destination" } });
    const offered = [DESTINATIONS.CORRUPTION];
    setRunProgress({
      destinationIndexInAct: 0,
      roomsEncountered: 0,
      completedDestinations: [],
      lastOfferedDestinations: [],
    });
    dispatchRunSessionCommand(
      (draft) => acceptCommand(setRewardState(draft, { ...createEmptyRewardState(), destinations: offered })),
      undefined,
      defaultGameSession,
    );

    const navigateTo = vi.fn((_screen: string, onCommitted?: () => void) => onCommitted?.());
    createRunFlow(makeFlowHandlerDeps({ navigateTo }), defaultGameSession).handleDestinationChoice(
      DESTINATIONS.CORRUPTION,
    );

    expect(readActiveRun(defaultGameSession).lastOfferedDestinations).toEqual(offered);
    expect(readActiveRun(defaultGameSession).completedDestinations).toEqual([DESTINATIONS.CORRUPTION]);

    createRunFlow(makeFlowHandlerDeps({ navigateTo }), defaultGameSession).advanceToNextDestination("corruption");

    expect(readRunSession(defaultGameSession).rewardFlow.state.destinations).toEqual(offered);
    expect(readActiveRun(defaultGameSession).destinationIndexInAct).toBe(0);
    expect(readActiveRun(defaultGameSession).completedDestinations).toEqual([]);
  });
});
