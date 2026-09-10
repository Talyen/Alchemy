import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gridLabyrinthMapFixture } from "../../../fixtures/labyrinth-map";
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
  return "labyrinth-floor-1-n0";
}

beforeEach(() => {
  resetTransientRunUi();
  dispatchRunSessionCommand((draft) => setLabyrinthMap(draft, gridLabyrinthMapFixture()));
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
    expect(readRunSession().labyrinthMap!.currentNodeId).toBe(target);
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

  it("inspects the distant boss without entering it", () => {
    const { result } = renderHook(() => useLabyrinthController());
    const map = readRunSession().labyrinthMap!;
    const locked = Object.values(map.nodes).find((node) => node.type === "boss");
    expect(locked).toBeDefined();

    let entered = true;
    act(() => {
      result.current.selectNode(firstReachableId());
      result.current.selectNode(locked!.id);
      entered = result.current.enterSelectedNode(stubNodeHandlers());
    });

    expect(readRunSession().selectedLabyrinthNodeId).toBe(locked!.id);
    expect(entered).toBe(false);
    expect(readRunSession().activeLabyrinthPendingNode).toBeNull();
  });

  it.each(["labyrinth-floor-1-n4", "missing-node"])("rejects undiscovered or missing selection %s", (nodeId) => {
    const { result } = renderHook(() => useLabyrinthController());
    act(() => {
      result.current.selectNode(firstReachableId());
      result.current.selectNode(nodeId);
    });
    expect(readRunSession().selectedLabyrinthNodeId).toBeNull();
  });

  it("descends once from a completed boss and rejects prior-floor entry", () => {
    const { result } = renderHook(() => useLabyrinthController());
    const boss = Object.values(readRunSession().labyrinthMap!.nodes).find((node) => node.type === "boss")!;
    act(() => {
      result.current.selectNode(boss.id);
      result.current.descend();
    });
    expect(readRunSession().labyrinthMap!.currentFloor).toBe(1);
    act(() => {
      dispatchRunSessionCommand((draft) => {
        draft.session.labyrinthMap!.nodes[boss.id]!.cleared = true;
        draft.session.labyrinthMap!.currentNodeId = boss.id;
      });
      result.current.descend();
      result.current.descend();
    });
    const next = readRunSession().labyrinthMap!;
    expect(next.currentFloor).toBe(2);
    expect(next.floors).toHaveLength(2);
    expect(next.nodes[next.currentNodeId]?.type).toBe("entrance");
    act(() => {
      result.current.selectNode(boss.id);
      result.current.descend();
    });
    expect(readRunSession().selectedLabyrinthNodeId).toBeNull();
    expect(readRunSession().labyrinthMap).toBe(next);
  });

  it("does not move or clear a room when its destination fails to open", () => {
    const { result } = renderHook(() => useLabyrinthController());
    const target = firstReachableId();
    act(() => result.current.selectNode(target));
    expect(() =>
      act(() =>
        result.current.enterSelectedNode(
          stubNodeHandlers({
            onStartBattleWithModifiers: () => {
              throw new Error("Cannot start battle");
            },
          }),
        ),
      ),
    ).toThrow("Cannot start battle");
    expect(readRunSession().activeLabyrinthPendingNode).toBeNull();
    expect(readRunSession().labyrinthMap!.currentNodeId).toBe("labyrinth-floor-1-entrance");
    expect(readRunSession().labyrinthMap!.nodes[target]!.cleared).toBe(false);
  });

  it("routes corruption chambers to onStartCorruption with room modifiers", () => {
    const corruptionId = firstReachableId();
    dispatchRunSessionCommand((draft) => {
      const node = draft.session.labyrinthMap!.nodes[corruptionId]!;
      node.type = "corruption";
      node.rewardModifiers = ["blood-rite"];
      delete node.enemyId;
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
  it("enters a previously discovered branch without moving through completed rooms", () => {
    const { result } = renderHook(() => useLabyrinthController());
    const handlers = stubNodeHandlers();
    act(() => {
      result.current.selectNode(firstReachableId());
      result.current.enterSelectedNode(handlers);
      result.current.onNodeCleared();
      result.current.selectNode("labyrinth-floor-1-n3");
      result.current.enterSelectedNode(handlers);
    });
    expect(handlers.onStartBattleWithModifiers).toHaveBeenCalledOnce();
    expect(handlers.onStartRest).toHaveBeenCalledOnce();
    expect(readRunSession().activeLabyrinthPendingNode).toBe("labyrinth-floor-1-n3");
    expect(readRunSession().labyrinthMap!.currentNodeId).toBe(firstReachableId());
    act(() => result.current.onNodeCleared());
    expect(readRunSession().labyrinthMap!.currentNodeId).toBe("labyrinth-floor-1-n3");
  });
});
