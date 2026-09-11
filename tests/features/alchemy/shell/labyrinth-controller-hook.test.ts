import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gridLabyrinthMapFixture } from "../../../fixtures/labyrinth-map";
import {
  createLabyrinthController,
  type LabyrinthNodeHandlers,
} from "@/features/alchemy/run-loop/run/labyrinth-controller";
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

describe("Labyrinth commands", () => {
  it("select then enter records a pending node and routes combat nodes", () => {
    const onStartBattle = vi.fn();
    const controller = createLabyrinthController();
    const target = firstReachableId();

    let entered = false;
    act(() => {
      controller.selectNode(target);
      entered = controller.enterSelectedNode(stubNodeHandlers({ onStartBattleWithModifiers: onStartBattle }));
    });

    expect(entered).toBe(true);
    expect(readRunSession().activeLabyrinthPendingNode).toBe(target);
    expect(onStartBattle).toHaveBeenCalledOnce();
  });

  it("onNodeCleared marks the pending node cleared", () => {
    const controller = createLabyrinthController();
    const target = firstReachableId();

    act(() => {
      controller.selectNode(target);
      controller.enterSelectedNode(stubNodeHandlers());
      controller.onNodeCleared();
    });

    expect(readRunSession().activeLabyrinthPendingNode).toBeNull();
    expect(readRunSession().labyrinthMap!.nodes[target]?.cleared).toBe(true);
    expect(readRunSession().labyrinthMap!.currentNodeId).toBe(target);
  });

  it("enterSelectedNode rejects a second enter while a node is pending", () => {
    const onStartBattle = vi.fn();
    const controller = createLabyrinthController();
    const target = firstReachableId();
    const handlers = stubNodeHandlers({ onStartBattleWithModifiers: onStartBattle });

    let first = false;
    let second = true;
    act(() => {
      controller.selectNode(target);
      first = controller.enterSelectedNode(handlers);
      second = controller.enterSelectedNode(handlers);
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(onStartBattle).toHaveBeenCalledOnce();
  });

  it("inspects the distant boss without entering it", () => {
    const controller = createLabyrinthController();
    const map = readRunSession().labyrinthMap!;
    const locked = Object.values(map.nodes).find((node) => node.type === "boss");
    expect(locked).toBeDefined();

    let entered = true;
    act(() => {
      controller.selectNode(firstReachableId());
      controller.selectNode(locked!.id);
      entered = controller.enterSelectedNode(stubNodeHandlers());
    });

    expect(readRunSession().selectedLabyrinthNodeId).toBe(locked!.id);
    expect(entered).toBe(false);
    expect(readRunSession().activeLabyrinthPendingNode).toBeNull();
  });

  it.each(["labyrinth-floor-1-n4", "missing-node"])("rejects undiscovered or missing selection %s", (nodeId) => {
    const controller = createLabyrinthController();
    act(() => {
      controller.selectNode(firstReachableId());
      controller.selectNode(nodeId);
    });
    expect(readRunSession().selectedLabyrinthNodeId).toBeNull();
  });

  it("descends once from a completed boss and rejects prior-floor entry", () => {
    const controller = createLabyrinthController();
    const boss = Object.values(readRunSession().labyrinthMap!.nodes).find((node) => node.type === "boss")!;
    act(() => {
      controller.selectNode(boss.id);
      controller.descend();
    });
    expect(readRunSession().labyrinthMap!.currentFloor).toBe(1);
    act(() => {
      dispatchRunSessionCommand((draft) => {
        draft.session.labyrinthMap!.nodes[boss.id]!.cleared = true;
        draft.session.labyrinthMap!.currentNodeId = boss.id;
      });
      controller.descend();
      controller.descend();
    });
    const next = readRunSession().labyrinthMap!;
    expect(next.currentFloor).toBe(2);
    expect(next.floors).toHaveLength(2);
    expect(next.nodes[next.currentNodeId]?.type).toBe("entrance");
    act(() => {
      controller.selectNode(boss.id);
      controller.descend();
    });
    expect(readRunSession().selectedLabyrinthNodeId).toBeNull();
    expect(readRunSession().labyrinthMap).toBe(next);
  });

  it("does not move or clear a room when its destination fails to open", () => {
    const controller = createLabyrinthController();
    const target = firstReachableId();
    act(() => controller.selectNode(target));
    expect(() =>
      act(() =>
        controller.enterSelectedNode(
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
    const controller = createLabyrinthController();

    let entered = false;
    act(() => {
      controller.selectNode(corruptionId);
      entered = controller.enterSelectedNode(stubNodeHandlers({ onStartCorruption }));
    });

    expect(entered).toBe(true);
    expect(onStartCorruption).toHaveBeenCalledWith(["blood-rite"]);
    expect(readRunSession().activeLabyrinthPendingNode).toBe(corruptionId);
  });
  it("enters a previously discovered branch without moving through completed rooms", () => {
    const controller = createLabyrinthController();
    const handlers = stubNodeHandlers();
    act(() => {
      controller.selectNode(firstReachableId());
      controller.enterSelectedNode(handlers);
      controller.onNodeCleared();
      controller.selectNode("labyrinth-floor-1-n3");
      controller.enterSelectedNode(handlers);
    });
    expect(handlers.onStartBattleWithModifiers).toHaveBeenCalledOnce();
    expect(handlers.onStartRest).toHaveBeenCalledOnce();
    expect(readRunSession().activeLabyrinthPendingNode).toBe("labyrinth-floor-1-n3");
    expect(readRunSession().labyrinthMap!.currentNodeId).toBe(firstReachableId());
    act(() => controller.onNodeCleared());
    expect(readRunSession().labyrinthMap!.currentNodeId).toBe("labyrinth-floor-1-n3");
  });
});
