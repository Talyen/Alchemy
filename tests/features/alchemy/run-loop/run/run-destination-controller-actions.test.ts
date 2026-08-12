import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import * as config from "@/features/alchemy/shared/config";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { getRunAvailableDestinations } from "@/features/alchemy/shared/run-flow/destination-flow";
import { getPreviousDestination } from "@/features/alchemy/shared/run-flow/campaign-start";
import { CONSTANTS } from "@/features/alchemy/shared/types";
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
});
