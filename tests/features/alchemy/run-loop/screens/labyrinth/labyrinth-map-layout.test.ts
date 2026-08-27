import { describe, expect, it } from "vitest";
import {
  inspectorPlacement,
  layoutFloorNodes,
} from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-layout";
import { hexAt } from "@/lib/content-systems/labyrinth/hex-grid";
import { LABYRINTH_MAP_UI } from "@/lib/game-constants";
import type { LabyrinthNode } from "@/lib/content-systems/types";

function node(id: string, position: { row: number; col: number }): LabyrinthNode {
  return {
    id,
    type: "combat",
    floor: 1,
    gridPosition: position,
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
      [node("a", hexAt(0, 0)), node("b", hexAt(0, 2)), node("c", hexAt(8, 0)), node("d", hexAt(8, 2))],
      availableWidth,
    );
    const halfWidth = layout.metrics.width / 2;
    for (const point of layout.positions.values()) {
      expect(point.x - halfWidth).toBeGreaterThanOrEqual(-0.5);
      expect(point.x + halfWidth).toBeLessThanOrEqual(availableWidth + 0.5);
    }
  });
});

describe("inspectorPlacement", () => {
  it("anchors to the right when the card fits", () => {
    const placement = inspectorPlacement(80, 40, 60, 500);
    expect(placement.side).toBe("right");
    expect(placement.left).toBeGreaterThan(80);
    expect(placement.left + LABYRINTH_MAP_UI.inspectorWidthPx).toBeLessThanOrEqual(500);
  });

  it("flips to the left when the right side would clip", () => {
    const placement = inspectorPlacement(400, 40, 60, 420);
    expect(placement.side).toBe("left");
    expect(placement.left).toBeGreaterThanOrEqual(0);
  });
});
