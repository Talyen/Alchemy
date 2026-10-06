import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setRunProgressActivity,
  setRewardState,
  setShopState,
  setScreen,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  useAlchemistScreenData,
  useCampfireScreenData,
  useTransmutationScreenData,
  useCorruptionScreenData,
  useDestinationScreenData,
  useEquipmentShopScreenData,
  useMysteryScreenData,
  useRewardsScreenData,
  useShopScreenData,
  useRunEndScreenData,
  useLabyrinthMapScreenData,
  useTrinketShopScreenData,
  useWildwoodRemovalScreenData,
} from "@/features/alchemy/shared/stores/use-run-screen-data";
import type { RunDataScreen } from "@/features/alchemy/shared/stores/run-screen-data";
import { teardownRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { emptyShopState, readActivityData } from "@/lib/active-run-session";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { resetAllTestStores } from "../../../../helpers/run-domain-store-test";
import { setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetAllTestStores();
});

// Every RunScreenDataByScreen key must resolve to a data hook: adding a screen
// without extending this registry is a compile error (Record<RunDataScreen>).
const SCREEN_HOOKS: Record<RunDataScreen, () => unknown> = {
  campfire: useCampfireScreenData,
  transmutation: useTransmutationScreenData,
  shop: useShopScreenData,
  alchemist: useAlchemistScreenData,
  "trinket-shop": useTrinketShopScreenData,
  "equipment-shop": useEquipmentShopScreenData,
  "labyrinth-map": useLabyrinthMapScreenData,
  rewards: useRewardsScreenData,
  destination: useDestinationScreenData,
  mystery: useMysteryScreenData,
  corruption: useCorruptionScreenData,
  "game-over": useRunEndScreenData,
  "run-victory": useRunEndScreenData,
  "wildwood-removal": useWildwoodRemovalScreenData,
};

describe("screen hook coverage", () => {
  it("resolves every screen to a data hook", () => {
    for (const hook of Object.values(SCREEN_HOOKS)) {
      const { result } = renderHook(() => hook());
      expect(result.current).toBeDefined();
    }
  });
});

describe("screen-specific run data hooks", () => {
  it.each(["game-over", "run-victory"] as const)("retains the %s summary while teardown clears the run", (screen) => {
    setRunSession({ runEndTalentXP: { physical: 25 }, runEndLabyrinthFloor: 7 });
    dispatchRunSessionCommand((draft) => acceptCommand(setScreen(draft, screen)), undefined, defaultGameSession);
    const { result } = renderHook(() => useRunEndScreenData());
    const shown = result.current;
    act(() => teardownRun(defaultGameSession));
    expect(readRunSession(defaultGameSession).runEndTalentXP).toEqual({});
    expect(result.current).toBe(shown);
    expect(result.current.runEndLabyrinthFloor).toBe(7);
  });

  it("retains the selected map room while entering an encounter", () => {
    setRunSession({ activity: { kind: "labyrinth-map" }, selectedLabyrinthNodeId: "room-1" });
    const { result } = renderHook(() => useLabyrinthMapScreenData());
    act(() => {
      dispatchRunSessionCommand(
        (draft) => acceptCommand(setShopState(draft, emptyShopState())),
        undefined,
        defaultGameSession,
      );
      setRunSession({ selectedLabyrinthNodeId: null });
    });
    expect(readRunSession(defaultGameSession).selectedLabyrinthNodeId).toBeNull();
    expect(result.current.selectedLabyrinthNodeId).toBe("room-1");
  });
  it("returns only the exact fields owned by the shop screen", () => {
    setRunProgress({ gold: 42, runDeck: [] });
    const { result } = renderHook(() => useShopScreenData());

    expect(result.current).toEqual({
      gold: 42,
      runDeck: [],
      shopState: readActivityData(readRunSession(defaultGameSession).activity, "shop"),
    });
    expect(result.current).not.toHaveProperty("rewardState");
  });

  it("keeps reward data separate from unrelated route fields", () => {
    const { result } = renderHook(() => useRewardsScreenData());

    expect(result.current).toEqual({
      rewardState: readRunSession(defaultGameSession).rewardFlow.state,
      rewardClaimInFlight: false,
    });
    expect(result.current).not.toHaveProperty("runGold");
    expect(result.current).not.toHaveProperty("shopState");
  });

  it("preserves selective subscriptions for an active screen", () => {
    setRunSession({ activity: { kind: "shop", data: emptyShopState() } });
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useShopScreenData();
    });

    act(() => {
      dispatchRunSessionCommand(
        (draft) => acceptCommand(setRewardState(draft, { ...readRunSession(defaultGameSession).rewardFlow.state })),
        undefined,
        defaultGameSession,
      );
    });

    expect(renders).toBe(1);
  });
  it("holds the outgoing shelf without tracking later writes, then reads a fresh visit", () => {
    setRunProgress({ gold: 42 });
    setRunSession({ hasActiveRun: true, activity: { kind: "shop", data: emptyShopState() } });
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useShopScreenData();
    });
    act(() =>
      dispatchRunSessionCommand(
        (draft) => acceptCommand(setShopState(draft, { ...emptyShopState(), refreshesLeft: 0 })),
        undefined,
        defaultGameSession,
      ),
    );
    const outgoing = result.current;
    act(() =>
      dispatchRunSessionCommand(
        (draft) => acceptCommand(setRunProgressActivity(draft, "destination")),
        undefined,
        defaultGameSession,
      ),
    );
    expect(readRunSession(defaultGameSession).activity).toEqual({ kind: "destination" });
    expect(result.current).toBe(outgoing);
    expect(result.current.shopState.refreshesLeft).toBe(0);
    const inactiveRenders = renders;
    act(() => setRunProgress({ gold: 99 }));
    expect(result.current).toBe(outgoing);
    expect(result.current.gold).toBe(42);
    expect(renders).toBe(inactiveRenders);

    act(() =>
      dispatchRunSessionCommand(
        (draft) => acceptCommand(setShopState(draft, emptyShopState())),
        undefined,
        defaultGameSession,
      ),
    );
    expect(result.current).not.toBe(outgoing);
    expect(result.current.shopState.refreshesLeft).toBe(emptyShopState().refreshesLeft);
    expect(result.current.gold).toBe(99);
  });
});
