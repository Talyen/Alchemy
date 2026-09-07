import { describe, expect, it } from "vitest";
import { layoutFloorNodes } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-layout";
import { hexAt, areHexesAdjacent } from "@/lib/content-systems/labyrinth/hex-grid";
import { generateFloorLayout } from "@/lib/content-systems/labyrinth/hex-layout";
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
  it("fits the width of every floor variant while keeping chamber size independent of viewport height", () => {
    for (const count of [12, 13, 14]) {
      for (let variant = 0; variant < 6; variant += 1) {
        const nodes = generateFloorLayout(count, () => variant / 6).map((p, i) => node(String(i), p));
        for (const width of [240, 320, 800, 1400]) {
          for (const maximumNodeWidth of [160, 200, 240]) {
            const layout = layoutFloorNodes(nodes, width, maximumNodeWidth);
            expect(layout.metrics.width).toBeLessThanOrEqual(maximumNodeWidth);
            for (const point of layout.positions.values()) {
              expect(point.x - layout.metrics.width / 2).toBeGreaterThanOrEqual(0);
              expect(point.x + layout.metrics.width / 2).toBeLessThanOrEqual(width);
              expect(point.y - layout.metrics.height / 2).toBeGreaterThanOrEqual(0);
              expect(point.y + layout.metrics.height / 2).toBeLessThanOrEqual(layout.height);
            }
          }
        }
      }
    }
  });

  it("caps large-screen chambers and produces a scrollable floor", () => {
    const nodes = generateFloorLayout(14, () => 0).map((p, i) => node(String(i), p));
    const layout = layoutFloorNodes(nodes, 1200, 200);
    expect(layout.metrics.width).toBeCloseTo(200);
    expect(layout.height).toBeGreaterThan(720);
  });

  it("keeps positions and size unchanged when chambers clear", () => {
    const nodes = [node("a", hexAt(0, 0)), node("b", hexAt(4, 2)), node("c", hexAt(8, 0))];
    expect(
      layoutFloorNodes(
        nodes.map((item) => ({ ...item, cleared: true })),
        420,
        500,
      ),
    ).toEqual(layoutFloorNodes(nodes, 420, 500));
  });

  it("packs adjacent hexes at exactly one apothem pair apart", () => {
    const nodes = generateFloorLayout(14, () => 0.5).map((p, i) => node(String(i), p));
    const layout = layoutFloorNodes(nodes, 600, 500);
    for (const a of nodes) {
      for (const b of nodes) {
        if (!areHexesAdjacent(a.gridPosition, b.gridPosition)) continue;
        const pa = layout.positions.get(a.id)!;
        const pb = layout.positions.get(b.id)!;
        expect(Math.hypot(pa.x - pb.x, pa.y - pb.y)).toBeCloseTo(layout.metrics.width);
      }
    }
  });

  it("normalizes saved rows without assuming a zero origin", () => {
    const layout = layoutFloorNodes([node("a", hexAt(4, 2)), node("b", hexAt(6, 2))], 400, 400);
    expect(layout.positions.get("a")!.x).toBe(200);
    expect(layout.positions.get("a")!.y - layout.metrics.height / 2).toBeCloseTo(32);
    expect((layout.positions.get("a")!.y + layout.positions.get("b")!.y) / 2).toBeCloseTo(layout.height / 2);
  });
});
