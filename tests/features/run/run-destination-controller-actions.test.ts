import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import * as config from "@/features/alchemy/shared/config";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import { getRunSessionStoreView } from "../../helpers/run-domain-store-test";
import { makeFlowHandlerDeps } from "../../helpers/run-flow-handler-deps";

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
});
