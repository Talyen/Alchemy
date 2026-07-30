// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  useRewardsScreenData,
  useScreenAssetPreloadData,
  useShopScreenData,
} from "@/features/alchemy/shared/stores/run-session-facade";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import {
  getRunSessionStoreView,
  resetRunProgressSlice,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunProgressSlice();
  resetTransientRunUi();
});

describe("screen-specific run data hooks", () => {
  it("returns only the exact fields owned by the shop screen", () => {
    setRunProgress({ runGold: 42, runDeck: [] });
    const { result } = renderHook(() => useShopScreenData());

    expect(result.current).toEqual({
      runGold: 42,
      runDeck: [],
      shopState: getRunSessionStoreView().shopState,
    });
    expect(result.current).not.toHaveProperty("rewardState");
  });

  it("keeps reward data separate from unrelated route fields", () => {
    const { result } = renderHook(() => useRewardsScreenData());

    expect(result.current).toEqual({ rewardState: getRunSessionStoreView().rewardState });
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
      getRunSessionStoreView().setRewardState({ ...getRunSessionStoreView().rewardState });
    });

    expect(renders).toBe(1);
  });

  it("preload projection only exposes asset-bearing transient state", () => {
    const { result } = renderHook(() => useScreenAssetPreloadData("shop"));

    expect(result.current.shopState).toEqual(getRunSessionStoreView().shopState);
    expect(result.current.rewardState).toBeNull();
    expect(result.current.alchemistState).toBeNull();
    expect(result.current.mysteryEvent).toBeNull();
  });
});
