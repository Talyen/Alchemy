// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { LABYRINTH_ENTRANCE_NODE_ID } from "@/lib/content-systems/labyrinth/data";
import { createSeededRng } from "@/lib/utils";
import { useLabyrinthController, type LabyrinthNodeHandlers } from "@/features/alchemy/shell/use-labyrinth-controller";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { getRunSessionStoreView } from "../../../helpers/run-domain-store-test";

function stubNodeHandlers(overrides: Partial<LabyrinthNodeHandlers> = {}): LabyrinthNodeHandlers {
  return {
    onStartBattleWithModifiers: vi.fn(),
    onStartBossBattleWithModifiers: vi.fn(),
    onStartRest: vi.fn(),
    onStartMystery: vi.fn(),
    onStartShop: vi.fn(),
    onStartAlchemist: vi.fn(),
    onStartTrinketShop: vi.fn(),
    onStartEquipmentShop: vi.fn(),
    ...overrides,
  };
}

function firstReachableId() {
  const map = getRunSessionStoreView().labyrinthMap;
  return map.nodes[LABYRINTH_ENTRANCE_NODE_ID]!.outgoingIds[0]!;
}

beforeEach(() => {
  resetTransientRunUi();
  getRunSessionStoreView().setLabyrinthMap(generateLabyrinthMap(createSeededRng(42)));
});

describe("useLabyrinthController hook", () => {
  it("select then enter records a pending node and routes combat nodes", () => {
    const onStartBattle = vi.fn();
    const { result } = renderHook(() => useLabyrinthController());
    const target = firstReachableId();

    let entered = false;
    act(() => {
      result.current.selectNode(target);
      entered = result.current.enterSelectedNode(stubNodeHandlers({ onStartBattleWithModifiers: onStartBattle }));
    });

    expect(entered).toBe(true);
    expect(getRunSessionStoreView().activeLabyrinthPendingNode).toBe(target);
    expect(onStartBattle).toHaveBeenCalledOnce();
  });

  it("onNodeCleared marks the pending node cleared", () => {
    const { result } = renderHook(() => useLabyrinthController());
    const target = firstReachableId();

    act(() => {
      result.current.selectNode(target);
      result.current.enterSelectedNode(stubNodeHandlers());
      result.current.onNodeCleared();
    });

    expect(getRunSessionStoreView().activeLabyrinthPendingNode).toBeNull();
    expect(getRunSessionStoreView().labyrinthMap.nodes[target]?.cleared).toBe(true);
  });

  it("enterSelectedNode rejects a second enter while a node is pending", () => {
    const onStartBattle = vi.fn();
    const { result } = renderHook(() => useLabyrinthController());
    const target = firstReachableId();
    const handlers = stubNodeHandlers({ onStartBattleWithModifiers: onStartBattle });

    let first = false;
    let second = true;
    act(() => {
      result.current.selectNode(target);
      first = result.current.enterSelectedNode(handlers);
      second = result.current.enterSelectedNode(handlers);
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(onStartBattle).toHaveBeenCalledOnce();
  });

  it("selects a locked chamber without allowing enter", () => {
    const { result } = renderHook(() => useLabyrinthController());
    const map = getRunSessionStoreView().labyrinthMap;
    const locked = Object.values(map.nodes).find(
      (node) => node.floor > 0 && node.id !== firstReachableId() && !node.cleared,
    );
    expect(locked).toBeDefined();

    let entered = true;
    act(() => {
      result.current.selectNode(locked!.id);
      entered = result.current.enterSelectedNode(stubNodeHandlers());
    });

    expect(getRunSessionStoreView().selectedLabyrinthNodeId).toBe(locked!.id);
    expect(entered).toBe(false);
    expect(getRunSessionStoreView().activeLabyrinthPendingNode).toBeNull();
  });

  it("resetMap clears pending selection and rebuilds the map", () => {
    const { result } = renderHook(() => useLabyrinthController());
    act(() => {
      result.current.selectNode(firstReachableId());
      result.current.resetMap();
    });
    expect(getRunSessionStoreView().activeLabyrinthPendingNode).toBeNull();
    expect(getRunSessionStoreView().selectedLabyrinthNodeId).toBeNull();
    expect(getRunSessionStoreView().labyrinthMap.nodes[LABYRINTH_ENTRANCE_NODE_ID]?.type).toBe("entrance");
  });
});
