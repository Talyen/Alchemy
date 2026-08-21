import "../../../helpers/mock-audio";
import { beforeEach, describe, expect, it } from "vitest";

import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import {
  getRunSessionStoreView,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../helpers/run-domain-store-test";
import { makeFlowHandlerDeps } from "../../../helpers/run-flow-handler-deps";

describe("Wildwood reward selection", () => {
  beforeEach(() => {
    resetRunDomainStore();
  });

  it("writes selectedRewardId in the same command as reward selectedId", () => {
    const wildwoodDraft = {
      ...createInitialWildwoodDraftState("knight", () => 0.5),
      phase: "reward" as const,
    };
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    setRunSession({
      wildwoodDraft,
      rewardState: createEmptyRewardState(),
    });

    createRunFlowHandlers(makeFlowHandlerDeps()).selectRewardChoice("slash");

    expect(getRunSessionStoreView().rewardState.selectedId).toBe("slash");
    expect(getRunSessionStoreView().wildwoodDraft?.selectedRewardId).toBe("slash");
  });
});
