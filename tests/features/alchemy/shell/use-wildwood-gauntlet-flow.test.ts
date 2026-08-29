import "../../../helpers/mock-audio";
import { beforeEach, describe, expect, it } from "vitest";

import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../helpers/run-domain-store-test";
import { makeFlowHandlerDeps } from "../../../helpers/run-flow-handler-deps";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";

describe("Wildwood reward selection", () => {
  beforeEach(() => {
    resetRunDomainStore();
  });

  it("writes reward selection only on the generic reward state", () => {
    const wildwoodDraft = {
      ...createInitialWildwoodDraftState("knight", () => 0.5),
      phase: "reward" as const,
    };
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.WILDWOOD });
    setRunSession({
      wildwoodDraft,
      rewardState: createEmptyRewardState(),
    });

    createRunFlowHandlers(makeFlowHandlerDeps()).selectRewardChoice("slash");

    expect(readRunSession().rewardState.selectedId).toBe("slash");
    expect(readRunSession().wildwoodDraft).toEqual(wildwoodDraft);
  });
});
