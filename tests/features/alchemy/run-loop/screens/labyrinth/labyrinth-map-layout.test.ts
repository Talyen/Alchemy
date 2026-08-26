import { describe, expect, it } from "vitest";
import { layoutFloorNodes } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-layout";
import type { LabyrinthNode } from "@/lib/content-systems/types";

function node(id: string, row: number, col: number): LabyrinthNode {
  return {
    id,
    type: "combat",
    floor: 1,
    gridPosition: { row, col },
    modifiers: [],
    rewardModifiers: [],
    outgoingIds: [],
    cleared: false,
  };
}

describe("layoutFloorNodes", () => {
  it("keeps seal extents inside the available width", () => {
    const availableWidth = 400;
    const layout = layoutFloorNodes(
      [node("a", 0, 0), node("b", 0, 3), node("c", 5, -2), node("d", 5, 1)],
      availableWidth,
    );
    const halfWidth = layout.metrics.width / 2;
    for (const point of layout.positions.values()) {
      expect(point.x - halfWidth).toBeGreaterThanOrEqual(-0.5);
      expect(point.x + halfWidth).toBeLessThanOrEqual(availableWidth + 0.5);
    }
  });
});
