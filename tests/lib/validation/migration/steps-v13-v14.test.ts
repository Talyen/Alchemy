import { describe, expect, it } from "vitest";
import { migrateV13ToV14 } from "@/lib/validation/migration/steps-v13-v14";
import { hexLabyrinthMapFixture } from "../../../fixtures/labyrinth-hex-map";

describe("migrateV13ToV14", () => {
  it("keeps campaign runs unchanged", () => {
    const parsed = { activeRun: { contentSystemType: "campaign", runPlayerHealth: 18 } };
    expect(migrateV13ToV14(parsed)).toEqual(parsed);
  });

  it("passes through hex Labyrinth maps and string pending ids", () => {
    const map = hexLabyrinthMapFixture();
    const parsed = {
      activeRun: {
        contentSystemType: "labyrinth",
        runPlayerHealth: 24,
        labyrinthMap: map,
        labyrinthPendingNode: "labyrinth-floor-1-n0",
      },
    };
    const migrated = migrateV13ToV14(parsed);
    expect(migrated.activeRun).toMatchObject({
      runPlayerHealth: 24,
      labyrinthMap: map,
      labyrinthPendingNode: "labyrinth-floor-1-n0",
    });
  });

  it("regenerates floor 1 from a legacy 8×9 grid without dropping the run", () => {
    const parsed = {
      activeRun: {
        contentSystemType: "labyrinth",
        runPlayerHealth: 24,
        rng: { seed: 42, counters: {} },
        labyrinthMap: { rows: 8, cols: 9, grid: [], currentNode: { row: 0, col: 4 } },
        labyrinthPendingNode: { row: 1, col: 4 },
      },
    };
    const migrated = migrateV13ToV14(parsed);
    const run = migrated.activeRun as Record<string, unknown>;
    expect(run.runPlayerHealth).toBe(24);
    expect(run.labyrinthPendingNode).toBeNull();
    const map = run.labyrinthMap as { floors: unknown[]; currentFloor: number; nodes: Record<string, unknown> };
    expect(map.currentFloor).toBe(1);
    expect(map.floors.length).toBeGreaterThanOrEqual(2);
    expect(map.nodes["labyrinth-entrance"]).toBeDefined();
  });

  it("regenerates parked Labyrinth grids without dropping the parked run", () => {
    const parsed = {
      parkedRuns: {
        labyrinth: {
          contentSystemType: "labyrinth",
          runPlayerHealth: 18,
          rng: { seed: 7, counters: {} },
          labyrinthMap: { rows: 8, cols: 9, grid: [], currentNode: { row: 0, col: 4 } },
          labyrinthPendingNode: { row: 2, col: 3 },
        },
      },
    };
    const migrated = migrateV13ToV14(parsed);
    const run = (migrated.parkedRuns as Record<string, Record<string, unknown>>).labyrinth;
    expect(run.runPlayerHealth).toBe(18);
    expect(run.labyrinthPendingNode).toBeNull();
    const map = run.labyrinthMap as { floors: unknown[]; currentFloor: number; nodes: Record<string, unknown> };
    expect(map.currentFloor).toBe(1);
    expect(map.floors.length).toBeGreaterThanOrEqual(2);
    expect(map.nodes["labyrinth-entrance"]).toBeDefined();
  });
});
