// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LABYRINTH_COLS } from "@/lib/content-systems/labyrinth/data";
import { useLabyrinthController } from "@/features/alchemy/use-labyrinth-controller";
import { useScreenStore } from "@/features/alchemy/stores/screen-store";

const START_COL = Math.floor(LABYRINTH_COLS / 2);

beforeEach(() => {
  useScreenStore.setState(useScreenStore.getInitialState());
  useScreenStore.getState().resetLabyrinthMap();
});

describe("useLabyrinthController hook", () => {
  it("enterNode records a pending node and routes combat nodes", () => {
    const onStartBattle = vi.fn();
    const { result } = renderHook(() => useLabyrinthController());
    const map = useScreenStore.getState().labyrinthMap;
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
      });
    });

    expect(entered).toBe(true);
    expect(useScreenStore.getState().activeLabyrinthPendingNode).toEqual(target);
    expect(onStartBattle).toHaveBeenCalledOnce();
  });

  it("onNodeCleared advances the map to the pending node", () => {
    const { result } = renderHook(() => useLabyrinthController());
    const map = useScreenStore.getState().labyrinthMap;
    const target = map.grid[0][START_COL]!.connections[0];

    act(() => {
      result.current.enterNode(target.row, target.col, {
        onStartBattleWithModifiers: vi.fn(),
        onStartBossBattleWithModifiers: vi.fn(),
        onStartRest: vi.fn(),
        onStartMystery: vi.fn(),
        onStartShop: vi.fn(),
        onStartAlchemist: vi.fn(),
      });
      result.current.onNodeCleared();
    });

    expect(useScreenStore.getState().activeLabyrinthPendingNode).toBeNull();
    expect(useScreenStore.getState().labyrinthMap.currentNode).toEqual(target);
    expect(useScreenStore.getState().labyrinthMap.grid[target.row][target.col]?.state).toBe("current");
  });

  it("resetMap clears pending state and regenerates the labyrinth", () => {
    const { result } = renderHook(() => useLabyrinthController());
    const before = useScreenStore.getState().labyrinthMap;

    act(() => {
      result.current.resetMap();
    });

    expect(useScreenStore.getState().activeLabyrinthPendingNode).toBeNull();
    expect(useScreenStore.getState().labyrinthMap).not.toBe(before);
    expect(useScreenStore.getState().labyrinthMap.grid[0][START_COL]?.type).toBe("entrance");
  });
});
