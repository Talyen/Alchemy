import { beforeEach, describe, expect, it } from "vitest";
import { gridLabyrinthMapFixture } from "../../../fixtures/labyrinth-map";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../helpers/run-domain-store-test";
import { createLabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { getStartingDeck } from "@/lib/game-data";

const target = "labyrinth-floor-1-n0";
beforeEach(() => {
  resetAllTestStores();
  setRunProgress({ contentSystemType: "labyrinth", runDeck: getStartingDeck("knight") });
  setRunSession({ activity: { kind: "labyrinth-map" }, labyrinthMap: gridLabyrinthMapFixture() });
});

describe("Labyrinth commands", () => {
  it("enters and clears a room once, preserving history and map progress", () => {
    const controller = createLabyrinthController();
    controller.selectNode(target);
    expect(controller.enterSelectedNode()?.screen).toBe("battle");
    const entered = readRunSession();
    expect(entered.activeLabyrinthPendingNode).toBe(target);
    expect(controller.enterSelectedNode()).toBeNull();
    expect(readRunSession().activity).toBe(entered.activity);
    controller.onNodeCleared();
    expect(readRunSession().activeLabyrinthPendingNode).toBeNull();
    expect(readRunSession().labyrinthMap!.nodes[target]?.cleared).toBe(true);
    expect(readRunSession().labyrinthMap!.currentNodeId).toBe(target);
    expect(readActiveRun().runHistory).toEqual([expect.objectContaining({ completed: true })]);
  });

  it("inspects the distant boss without entering it", () => {
    const controller = createLabyrinthController();
    const locked = Object.values(readRunSession().labyrinthMap!.nodes).find((node) => node.type === "boss")!;
    controller.selectNode(target);
    controller.selectNode(locked.id);
    expect(readRunSession().selectedLabyrinthNodeId).toBe(locked.id);
    expect(controller.enterSelectedNode()).toBeNull();
    expect(readRunSession().activeLabyrinthPendingNode).toBeNull();
  });

  it.each(["labyrinth-floor-1-n4", "missing-node"])("rejects undiscovered or missing selection %s", (nodeId) => {
    const controller = createLabyrinthController();
    controller.selectNode(target);
    controller.selectNode(nodeId);
    expect(readRunSession().selectedLabyrinthNodeId).toBeNull();
    expect(controller.enterSelectedNode()).toBeNull();
  });

  it("descends once from a completed boss and rejects prior-floor entry", () => {
    const controller = createLabyrinthController();
    const boss = Object.values(readRunSession().labyrinthMap!.nodes).find((node) => node.type === "boss")!;
    controller.selectNode(boss.id);
    controller.descend();
    expect(readRunSession().labyrinthMap!.currentFloor).toBe(1);
    dispatchGameplayCommand((draft) => {
      draft.session.labyrinthMap!.nodes[boss.id]!.cleared = true;
      draft.session.labyrinthMap!.currentNodeId = boss.id;
      return acceptCommand();
    });
    controller.descend();
    controller.descend();
    const next = readRunSession().labyrinthMap!;
    expect(next.currentFloor).toBe(2);
    expect(next.floors).toHaveLength(2);
    expect(next.nodes[next.currentNodeId]?.type).toBe("entrance");
    controller.selectNode(boss.id);
    controller.descend();
    expect(readRunSession().selectedLabyrinthNodeId).toBeNull();
    expect(readRunSession().labyrinthMap).toBe(next);
  });

  it("enters a discovered branch without moving through completed rooms", () => {
    const controller = createLabyrinthController();
    controller.selectNode(target);
    controller.enterSelectedNode();
    controller.onNodeCleared();
    setRunSession({ activity: { kind: "labyrinth-map" } });
    controller.selectNode("labyrinth-floor-1-n3");
    expect(controller.enterSelectedNode()?.screen).toBe("campfire");
    expect(readRunSession().activeLabyrinthPendingNode).toBe("labyrinth-floor-1-n3");
    expect(readRunSession().labyrinthMap!.currentNodeId).toBe(target);
    controller.onNodeCleared();
    expect(readRunSession().labyrinthMap!.currentNodeId).toBe("labyrinth-floor-1-n3");
  });
});
