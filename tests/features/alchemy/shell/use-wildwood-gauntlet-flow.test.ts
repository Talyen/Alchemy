// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWildwoodGauntletFlow } from "@/features/alchemy/shell/use-wildwood-gauntlet-flow";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import {
  getRunSessionStoreView,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../helpers/run-domain-store-test";

vi.mock("@/lib/audio", () => ({
  playDefeat: vi.fn(),
  stopAllSfx: vi.fn(),
}));

describe("useWildwoodGauntletFlow", () => {
  beforeEach(() => {
    resetRunDomainStore();
  });

  it("selectRewardChoice writes selectedRewardId from the live draft", () => {
    const wildwoodDraft = {
      ...createInitialWildwoodDraftState("knight", () => 0.5),
      phase: "reward" as const,
    };
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    setRunSession({ wildwoodDraft });

    const { result } = renderHook(() =>
      useWildwoodGauntletFlow({
        run: {
          contentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD,
          characterId: "knight",
          runDeck: [],
          updateRunDeck: vi.fn(),
        },
        navigateTo: vi.fn(),
        onStartBossById: vi.fn(),
        setHasActiveBattle: vi.fn(),
        clearCardHover: vi.fn(),
      }),
    );

    act(() => {
      result.current.selectRewardChoice("slash");
    });

    expect(getRunSessionStoreView().wildwoodDraft?.selectedRewardId).toBe("slash");
  });
});
