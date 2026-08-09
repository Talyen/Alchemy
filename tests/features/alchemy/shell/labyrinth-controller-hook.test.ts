// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LABYRINTH_COLS } from "@/lib/content-systems/labyrinth/data";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { createSeededRng } from "@/lib/utils";
import { useLabyrinthController } from "@/features/alchemy/shell/use-labyrinth-controller";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { getRunSessionStoreView } from "../../../helpers/run-domain-store-test";

const START_COL = Math.floor(LABYRINTH_COLS / 2);
beforeEach(() => {
  resetTransientRunUi();
  getRunSessionStoreView().setLabyrinthMap(generateLabyrinthMap(createSeededRng(42)));
});

describe("useLabyrinthController hook", () => {
  it("enterNode records a pending node and routes combat nodes", () => {
    const onStartBattle = vi.fn();
    const { result } = renderHook(() => useLabyrinthController("labyrinth-map"));
    const map = getRunSessionStoreView().labyrinthMap;
    const target = map.grid[0][START_COL]!.connections[0];

    let entered = false;
    act(() => {
      entered = result.current.enterNode(target.row, target.col, {
        onStartBattleWithModifiers: onStartBattle,
        onStartBossBattleWithModifiers: vi.fn(),
        onStartRest: vi.fn(),
        onStartMystery: vi.fn(),
        onStartShop: vi.fn(),
        onStartAlchemist: vi.fn(),
      } as any);
    });

    expect(entered).toBe(true);
    expect(getRunSessionStoreView().activeLabyrinthPendingNode).toEqual(target);
    expect(onStartBattle).toHaveBeenCalledOnce();
  });

  it("onNodeCleared advances the map to the pending node", () => {
    const { result } = renderHook(() => useLabyrinthController("labyrinth-map"));
    const map = getRunSessionStoreView().labyrinthMap;
    const target = map.grid[0][START_COL]!.connections[0];

    act(() => {
      result.current.enterNode(target.row, target.col, {
        onStartBattleWithModifiers: vi.fn(),
        onStartBossBattleWithModifiers: vi.fn(),
        onStartRest: vi.fn(),
        onStartMystery: vi.fn(),
        onStartShop: vi.fn(),
        onStartAlchemist: vi.fn(),
      } as any);
      result.current.onNodeCleared();
    });

    expect(getRunSessionStoreView().activeLabyrinthPendingNode).toBeNull();
    expect(getRunSessionStoreView().labyrinthMap.currentNode).toEqual(target);
    expect(getRunSessionStoreView().labyrinthMap.grid[target.row][target.col]?.state).toBe("current");
  });

  it("enterNode rejects a second enter while a node is pending", () => {
    const onStartBattle = vi.fn();
    const { result } = renderHook(() => useLabyrinthController("labyrinth-map"));
    const map = getRunSessionStoreView().labyrinthMap;
    const target = map.grid[0][START_COL]!.connections[0];
    const handlers = {
      onStartBattleWithModifiers: onStartBattle,
      onStartBossBattleWithModifiers: vi.fn(),
      onStartRest: vi.fn(),
      onStartMystery: vi.fn(),
      onStartShop: vi.fn(),
      onStartAlchemist: vi.fn(),
    } as any;

    let first = false;
    let second = true;
    act(() => {
      first = result.current.enterNode(target.row, target.col, handlers);
      second = result.current.enterNode(target.row, target.col, handlers);
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(onStartBattle).toHaveBeenCalledOnce();
  });

  it("enterNode trusts store pending after a store-only clear (e.g. teardown)", () => {
    const onStartBattle = vi.fn();
    const { result } = renderHook(() => useLabyrinthController("labyrinth-map"));
    const map = getRunSessionStoreView().labyrinthMap;
    const firstTarget = map.grid[0][START_COL]!.connections[0];
    const handlers = {
      onStartBattleWithModifiers: onStartBattle,
      onStartBossBattleWithModifiers: vi.fn(),
      onStartRest: vi.fn(),
      onStartMystery: vi.fn(),
      onStartShop: vi.fn(),
      onStartAlchemist: vi.fn(),
    } as any;

    act(() => {
      result.current.enterNode(firstTarget.row, firstTarget.col, handlers);
      // Simulate teardown / clearTransientSession without going through resetMap.
      getRunSessionStoreView().setActiveLabyrinthPendingNode(null);
    });

    const mapAfterClear = getRunSessionStoreView().labyrinthMap;
    const secondTarget = mapAfterClear.grid[0][START_COL]!.connections[0];
    let reentered = false;
    act(() => {
      reentered = result.current.enterNode(secondTarget.row, secondTarget.col, handlers);
    });

    expect(reentered).toBe(true);
    expect(getRunSessionStoreView().activeLabyrinthPendingNode).toEqual(secondTarget);
    expect(onStartBattle).toHaveBeenCalledTimes(2);
  });

  it("resetMap clears pending state and regenerates the labyrinth", () => {
    const { result } = renderHook(() => useLabyrinthController("labyrinth-map"));
    const before = getRunSessionStoreView().labyrinthMap;

    act(() => {
      result.current.resetMap();
    });

    expect(getRunSessionStoreView().activeLabyrinthPendingNode).toBeNull();
    expect(getRunSessionStoreView().labyrinthMap).not.toBe(before);
    expect(getRunSessionStoreView().labyrinthMap.grid[0][START_COL]?.type).toBe("entrance");
  });
});
