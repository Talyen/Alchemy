import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { LABYRINTH_ENTRANCE_NODE_ID } from "@/lib/content-systems/labyrinth/data";
import { createSeededRng } from "@/lib/utils";
import { useLabyrinthController, type LabyrinthNodeHandlers } from "@/features/alchemy/shell/use-labyrinth-controller";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { setLabyrinthMap } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";

function stubNodeHandlers(overrides: Partial<LabyrinthNodeHandlers> = {}): LabyrinthNodeHandlers {
  return {
    onStartBattleWithModifiers: vi.fn(),
    onStartBossBattleWithModifiers: vi.fn(),
    onStartRest: vi.fn(),
    onStartMystery: vi.fn(),
    onStartCorruption: vi.fn(),
    onStartShop: vi.fn(),
    onStartAlchemist: vi.fn(),
    onStartTrinketShop: vi.fn(),
    onStartEquipmentShop: vi.fn(),
    ...overrides,
  };
}

function firstReachableId() {
  const map = readRunSession().labyrinthMap!;
  return map.nodes[LABYRINTH_ENTRANCE_NODE_ID]!.outgoingIds[0]!;
}

beforeEach(() => {
  resetTransientRunUi();
  dispatchRunSessionCommand((draft) => setLabyrinthMap(draft, generateLabyrinthMap(createSeededRng(42))));
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
    expect(readRunSession().activeLabyrinthPendingNode).toBe(target);
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

    expect(readRunSession().activeLabyrinthPendingNode).toBeNull();
    expect(readRunSession().labyrinthMap!.nodes[target]?.cleared).toBe(true);
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

  it("deselects when a locked chamber is requested and never enters it", () => {
    const { result } = renderHook(() => useLabyrinthController());
    const map = readRunSession().labyrinthMap!;
    const locked = Object.values(map.nodes).find(
      (node) => node.floor > 0 && node.id !== firstReachableId() && !node.cleared,
    );
    expect(locked).toBeDefined();

    let entered = true;
    act(() => {
      result.current.selectNode(firstReachableId());
      result.current.selectNode(locked!.id);
      entered = result.current.enterSelectedNode(stubNodeHandlers());
    });

    expect(readRunSession().selectedLabyrinthNodeId).toBeNull();
    expect(entered).toBe(false);
    expect(readRunSession().activeLabyrinthPendingNode).toBeNull();
  });

  it.each([LABYRINTH_ENTRANCE_NODE_ID, "missing-node"])("rejects completed or missing selection %s", (nodeId) => {
    const { result } = renderHook(() => useLabyrinthController());
    act(() => {
      result.current.selectNode(firstReachableId());
      result.current.selectNode(nodeId);
    });
    expect(readRunSession().selectedLabyrinthNodeId).toBeNull();
  });

  it("resetMap clears pending selection and rebuilds the map", () => {
    const { result } = renderHook(() => useLabyrinthController());
    act(() => {
      result.current.selectNode(firstReachableId());
      result.current.resetMap();
    });
    expect(readRunSession().activeLabyrinthPendingNode).toBeNull();
    expect(readRunSession().selectedLabyrinthNodeId).toBeNull();
    expect(readRunSession().labyrinthMap!.nodes[LABYRINTH_ENTRANCE_NODE_ID]?.type).toBe("entrance");
  });

  it("routes corruption chambers to onStartCorruption with room modifiers", () => {
    const corruptionId = "labyrinth-floor-1-corruption";
    act(() => {
      dispatchRunSessionCommand((draft) => {
        const map = readRunSession().labyrinthMap!;
        setLabyrinthMap(draft, {
          ...map,
          floors: [
            { id: "labyrinth-floor-0", depth: 0, nodeIds: [LABYRINTH_ENTRANCE_NODE_ID] },
            { id: "labyrinth-floor-1", depth: 1, nodeIds: [corruptionId] },
          ],
          nodes: {
            [LABYRINTH_ENTRANCE_NODE_ID]: {
              ...map.nodes[LABYRINTH_ENTRANCE_NODE_ID]!,
              outgoingIds: [corruptionId],
            },
            [corruptionId]: {
              id: corruptionId,
              type: "corruption",
              floor: 1,
              gridPosition: { row: 0, col: 1 },
              modifiers: [],
              rewardModifiers: ["blood-rite"],
              outgoingIds: [],
              cleared: false,
            },
          },
        });
      });
    });
    const onStartCorruption = vi.fn();
    const { result } = renderHook(() => useLabyrinthController());

    let entered = false;
    act(() => {
      result.current.selectNode(corruptionId);
      entered = result.current.enterSelectedNode(stubNodeHandlers({ onStartCorruption }));
    });

    expect(entered).toBe(true);
    expect(onStartCorruption).toHaveBeenCalledWith(["blood-rite"]);
    expect(readRunSession().activeLabyrinthPendingNode).toBe(corruptionId);
  });
});
