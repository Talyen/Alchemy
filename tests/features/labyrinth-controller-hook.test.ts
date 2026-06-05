// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LABYRINTH_COLS } from "@/lib/content-systems/labyrinth/data";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { useLabyrinthController } from "@/features/alchemy/shell/use-labyrinth-controller";
import { resetScreenStores } from "@/features/alchemy/stores/screen-store";
import { getRunSessionStoreView } from "../helpers/run-domain-store-test";

const START_COL = Math.floor(LABYRINTH_COLS / 2);

beforeEach(() => {
  resetScreenStores();
  getRunSessionStoreView().setLabyrinthMap(generateLabyrinthMap());
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
      });
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
      });
      result.current.onNodeCleared();
    });

    expect(getRunSessionStoreView().activeLabyrinthPendingNode).toBeNull();
    expect(getRunSessionStoreView().labyrinthMap.currentNode).toEqual(target);
    expect(getRunSessionStoreView().labyrinthMap.grid[target.row][target.col]?.state).toBe("current");
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
