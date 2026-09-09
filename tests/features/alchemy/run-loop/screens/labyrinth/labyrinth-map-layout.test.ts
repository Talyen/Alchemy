import { describe, expect, it } from "vitest";
import { layoutFloorNodes } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-layout";
import { hexAt, areHexesAdjacent } from "@/lib/content-systems/labyrinth/hex-grid";
import { generateFloorLayout } from "@/lib/content-systems/labyrinth/hex-layout";
import type { LabyrinthNode } from "@/lib/content-systems/types";

function node(id: string, gridPosition: { row: number; col: number }, cleared = false): LabyrinthNode {
  return { id, type: "combat", floor: 1, gridPosition, modifiers: [], rewardModifiers: [], outgoingIds: [], cleared };
}

describe("Labyrinth floor geometry", () => {
  it("fits every production template in the viewport without clipping border strokes", () => {
    for (const count of [12, 13, 14]) {
      for (let variant = 0; variant < 6; variant += 1) {
        const nodes = generateFloorLayout(count, () => variant / 6).map((p, i) => node(String(i), p));
        for (const [width, height] of [
          [240, 400],
          [600, 350],
          [1200, 900],
        ]) {
          const layout = layoutFloorNodes(nodes, width!, height!);
          for (const edge of layout.edges) {
            for (const point of [edge.from, edge.to]) {
              expect(point.x).toBeGreaterThanOrEqual(2);
              expect(point.x).toBeLessThanOrEqual(width! - 2);
              expect(point.y).toBeGreaterThanOrEqual(2);
              expect(point.y).toBeLessThanOrEqual(height! - 2);
            }
          }
        }
      }
    }
  });

  it("uses identical shared vertices and renders each shared edge once at every orientation", () => {
    const nodes = generateFloorLayout(14, () => 0.5).map((p, i) => node(String(i), p));
    const layout = layoutFloorNodes(nodes, 600, 500);
    let adjacentPairs = 0;
    for (let i = 0; i < nodes.length; i += 1) {
      for (const b of nodes.slice(i + 1)) {
        const a = nodes[i]!;
        if (!areHexesAdjacent(a.gridPosition, b.gridPosition)) continue;
        adjacentPairs += 1;
        const pa = layout.positions.get(a.id)!;
        const pb = layout.positions.get(b.id)!;
        expect(Math.hypot(pa.x - pb.x, pa.y - pb.y)).toBeCloseTo(layout.metrics.width);
        expect(layout.edges.filter((edge) => edge.nodeIds.includes(a.id) && edge.nodeIds.includes(b.id))).toHaveLength(
          1,
        );
      }
    }
    expect(layout.edges).toHaveLength(nodes.length * 6 - adjacentPairs);
    for (const edge of layout.edges) {
      expect(Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y)).toBeCloseTo(layout.metrics.radius);
    }
  });

  it("preserves all geometry when rooms clear and normalizes nonzero saved origins", () => {
    const nodes = [node("a", hexAt(4, 2)), node("b", hexAt(6, 2))];
    const layout = layoutFloorNodes(nodes, 420, 500);
    expect(
      layoutFloorNodes(
        nodes.map((item) => ({ ...item, cleared: true })),
        420,
        500,
      ),
    ).toEqual(layout);
    expect(layout.positions.get("a")!.x).toBe(210);
    expect((layout.positions.get("a")!.y + layout.positions.get("b")!.y) / 2).toBe(250);
  });
});
