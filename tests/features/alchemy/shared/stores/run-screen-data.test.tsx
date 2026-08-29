import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useRewardsScreenData, useShopScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setRewardState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";

beforeEach(() => {
  resetAllTestStores();
});

describe("screen-specific run data hooks", () => {
  it("returns only the exact fields owned by the shop screen", () => {
    setRunProgress({ gold: 42, runDeck: [] });
    const { result } = renderHook(() => useShopScreenData());

    expect(result.current).toEqual({
      gold: 42,
      runDeck: [],
      shopState: readRunSession().shopState,
    });
    expect(result.current).not.toHaveProperty("rewardState");
  });

  it("keeps reward data separate from unrelated route fields", () => {
    const { result } = renderHook(() => useRewardsScreenData());

    expect(result.current).toEqual({
      rewardState: readRunSession().rewardState,
      rewardClaimInFlight: false,
    });
    expect(result.current).not.toHaveProperty("runGold");
    expect(result.current).not.toHaveProperty("shopState");
  });

  it("preserves selective subscriptions for a screen", () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useShopScreenData();
    });

    act(() => {
      dispatchRunSessionCommand((draft) => setRewardState(draft, { ...readRunSession().rewardState }));
    });

    expect(renders).toBe(1);
  });
});
