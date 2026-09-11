import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  prepareRunNavigation,
  setRewardState,
  setShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { useRewardsScreenData, useShopScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
import { emptyShopState, readActivityData } from "@/lib/active-run-session";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import { setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";

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
      shopState: readActivityData(readRunSession().activity, "shop"),
    });
    expect(result.current).not.toHaveProperty("rewardState");
  });

  it("keeps reward data separate from unrelated route fields", () => {
    const { result } = renderHook(() => useRewardsScreenData());

    expect(result.current).toEqual({
      rewardState: readRunSession().rewardFlow.state,
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
      dispatchRunSessionCommand((draft) => setRewardState(draft, { ...readRunSession().rewardFlow.state }));
    });

    expect(renders).toBe(1);
  });
  it("holds the outgoing shelf while navigation commits a different activity", () => {
    setRunProgress({ gold: 42 });
    setRunSession({ hasActiveRun: true, activity: { kind: "shop", data: emptyShopState() } });
    const { result } = renderHook(() => useShopScreenData());
    act(() => dispatchRunSessionCommand((draft) => setShopState(draft, { ...emptyShopState(), refreshesLeft: 0 })));
    const outgoing = result.current;
    act(() => dispatchRunSessionCommand((draft) => prepareRunNavigation(draft, "destination")));
    expect(readRunSession().activity).toEqual({ kind: "destination" });
    expect(result.current).toBe(outgoing);
    expect(result.current.shopState.refreshesLeft).toBe(0);
  });
});
