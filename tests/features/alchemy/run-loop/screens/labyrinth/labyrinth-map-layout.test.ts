import { describe, expect, it } from "vitest";
import { layoutFloorNodes } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-layout";
import { gridLabyrinthMapFixture } from "../../../../../fixtures/labyrinth-map";

describe("Open Field viewport layout", () => {
  it("fits all twenty 4:3 tiles and enlarged hover frames without clipping", () => {
    const nodes = Object.values(gridLabyrinthMapFixture().nodes);
    for (const [width, height] of [
      [240, 400],
      [600, 350],
      [1200, 900],
      [1800, 420],
    ]) {
      const layout = layoutFloorNodes(nodes, width!, height!);
      expect(layout.metrics.width / layout.metrics.height).toBeCloseTo(4 / 3);
      for (const point of layout.positions.values()) {
        expect(point.x - (layout.metrics.width * 1.06) / 2).toBeGreaterThanOrEqual(3);
        expect(point.x + (layout.metrics.width * 1.06) / 2).toBeLessThanOrEqual(width! - 3);
        expect(point.y - (layout.metrics.height * 1.06) / 2).toBeGreaterThanOrEqual(3);
        expect(point.y + (layout.metrics.height * 1.06) / 2).toBeLessThanOrEqual(height! - 3);
      }
      const xs = new Set([...layout.positions.values()].map((point) => point.x));
      const ys = new Set([...layout.positions.values()].map((point) => point.y));
      expect(xs.size).toBe(6);
      expect(ys.size).toBe(4);
      expect(
        layoutFloorNodes(
          nodes.map((node) => ({ ...node, cleared: true })),
          width!,
          height!,
        ),
      ).toEqual(layout);
    }
  });
});
