import { describe, expect, it } from "vitest";
import {
  clampInspectorTop,
  inspectorPlacement,
  layoutFloorNodes,
} from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-layout";
import { hexAt } from "@/lib/content-systems/labyrinth/hex-grid";
import { LABYRINTH_MAP_UI } from "@/lib/game-constants";
import type { LabyrinthNode } from "@/lib/content-systems/types";

function node(id: string, position: { row: number; col: number }, cleared = false): LabyrinthNode {
  return {
    id,
    type: "combat",
    floor: 1,
    gridPosition: position,
    modifiers: [],
    rewardModifiers: [],
    outgoingIds: [],
    cleared,
  };
}

describe("layoutFloorNodes", () => {
  it("keeps every seal inside the available width", () => {
    const availableWidth = 420;
    const layout = layoutFloorNodes(
      [node("a", hexAt(0, 0)), node("b", hexAt(1, 0)), node("c", hexAt(2, -1))],
      availableWidth,
    );
    const halfWidth = layout.metrics.width / 2;
    for (const point of layout.positions.values()) {
      expect(point.x - halfWidth).toBeGreaterThanOrEqual(-0.5);
      expect(point.x + halfWidth).toBeLessThanOrEqual(availableWidth + 0.5);
    }
  });

  it("uses even seal metrics after scale", () => {
    const layout = layoutFloorNodes([node("a", hexAt(0, 0)), node("b", hexAt(2, 0))], 400);
    expect(layout.metrics.width % 2).toBe(0);
    expect(layout.metrics.height % 2).toBe(0);
    expect(layout.metrics.verticalStep % 2).toBe(0);
    expect(layout.metrics.width).toBeLessThan(400);
  });

  it("compacts to visible bounds so cleared space is reclaimed and map stays near top", () => {
    const layout = layoutFloorNodes(
      [node("cleared", hexAt(0, 0), true), node("alive-low", hexAt(4, 0)), node("alive-high", hexAt(8, 0))],
      400,
    );
    expect(layout.positions.has("cleared")).toBe(true);
    expect(layout.height).toBe(4 * layout.metrics.verticalStep + layout.metrics.height);
    expect(layout.positions.get("alive-low")?.y).toBe(layout.metrics.height / 2);
    expect(layout.positions.get("alive-high")?.y).toBe(4 * layout.metrics.verticalStep + layout.metrics.height / 2);
  });

  it("keeps visible seals inside height after vertical compaction", () => {
    const layout = layoutFloorNodes(
      [node("cleared", hexAt(0, 0), true), node("a", hexAt(3, 0)), node("b", hexAt(5, 1)), node("c", hexAt(8, 0))],
      400,
    );
    const halfHeight = layout.metrics.height / 2;
    for (const [id, point] of layout.positions) {
      if (id === "cleared") continue;
      expect(point.y - halfHeight).toBeGreaterThanOrEqual(-0.5);
      expect(point.y + halfHeight).toBeLessThanOrEqual(layout.height + 0.5);
    }
  });

  it("re-centers horizontally on visible nodes", () => {
    const clearedLeft = node("cleared", hexAt(1, 0), true);
    const rightA = node("a", hexAt(1, 1));
    const rightB = node("b", hexAt(2, 1));
    const layoutMixed = layoutFloorNodes([clearedLeft, rightA, rightB], 420);
    const layoutVisibleOnly = layoutFloorNodes([rightA, rightB], 420);
    expect(layoutMixed.positions.get("a")?.x).toBe(layoutVisibleOnly.positions.get("a")?.x);
    expect(layoutMixed.positions.get("b")?.x).toBe(layoutVisibleOnly.positions.get("b")?.x);
  });
});

describe("inspectorPlacement", () => {
  it("anchors to the right when the card fits", () => {
    const placement = inspectorPlacement(80, 40, 60, 800);
    expect(placement.side).toBe("right");
    expect(placement.left).toBeGreaterThan(80);
    expect(placement.width).toBe(LABYRINTH_MAP_UI.inspectorWidthPx);
    expect(placement.left + placement.width).toBeLessThanOrEqual(800);
  });

  it("flips to the left when the right side would clip", () => {
    const placement = inspectorPlacement(400, 40, 60, 480);
    expect(placement.side).toBe("left");
    expect(placement.left).toBeLessThan(400);
  });

  it("shrinks width on narrow maps", () => {
    const placement = inspectorPlacement(40, 40, 60, 300);
    expect(placement.width).toBe(300 - 24);
    expect(placement.left + placement.width).toBeLessThanOrEqual(300);
  });
});

describe("clampInspectorTop", () => {
  it("leaves a centered inspector untouched", () => {
    expect(clampInspectorTop(300, 400, 800)).toBe(300);
  });

  it("pushes a top-anchored inspector down so it stays inside the canvas", () => {
    expect(clampInspectorTop(40, 400, 800)).toBe(200);
  });

  it("pulls a bottom-anchored inspector up so it stays inside the canvas", () => {
    expect(clampInspectorTop(790, 400, 800)).toBe(600);
  });

  it("returns top unchanged when heights are unknown", () => {
    expect(clampInspectorTop(40, 0, 800)).toBe(40);
    expect(clampInspectorTop(40, 400, 0)).toBe(40);
  });
});
