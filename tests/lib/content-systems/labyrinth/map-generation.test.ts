import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/lib/utils";
import {
  expandBeyondBoss,
  generateLabyrinthMap,
  orderTypesForPositions,
} from "@/lib/content-systems/labyrinth/map-generation";
import { canEnterLabyrinthNode, floorNodes, withClearedNode } from "@/lib/content-systems/labyrinth/map-state";
import {
  areGridNeighbors,
  gridKey,
  isInLabyrinthGrid,
  labyrinthGridPositions,
} from "@/lib/content-systems/labyrinth/grid";
import { LABYRINTH_SUPPORT_TYPES } from "@/lib/content-systems/labyrinth/data";
import type { LabyrinthGridPosition, LabyrinthNodeType } from "@/lib/content-systems/types";

describe("Open Field generation", () => {
  it("generates full grids with a safe top entrance, distant bottom boss and existing encounters", () => {
    const starts = new Set<number>();
    for (let seed = 1; seed <= 32; seed += 1) {
      const map = generateLabyrinthMap(createSeededRng(seed));
      const nodes = floorNodes(map, 1);
      expect(map.floors).toHaveLength(1);
      expect(nodes).toHaveLength(labyrinthGridPositions().length);
      expect(new Set(nodes.map((node) => gridKey(node.gridPosition))).size).toBe(20);
      expect(nodes.every((node) => isInLabyrinthGrid(node.gridPosition))).toBe(true);
      expect([0, 1, 2, 3].map((row) => nodes.filter((node) => node.gridPosition.row === row).length)).toEqual([
        4, 6, 6, 4,
      ]);
      const entrances = nodes.filter((node) => node.type === "entrance");
      const bosses = nodes.filter((node) => node.type === "boss");
      expect(entrances).toHaveLength(1);
      expect(bosses).toHaveLength(1);
      const entrance = entrances[0]!;
      const boss = bosses[0]!;
      starts.add(entrance.gridPosition.col);
      expect(entrance.gridPosition.row).toBe(0);
      expect(entrance.cleared).toBe(true);
      expect(entrance.modifiers).toEqual([]);
      expect(entrance.rewardModifiers).toEqual([]);
      expect(map.currentNodeId).toBe(entrance.id);
      expect(boss.gridPosition.row).toBe(3);
      expect(Math.abs(boss.gridPosition.col - entrance.gridPosition.col)).toBeGreaterThanOrEqual(2);
      expect(nodes.filter((node) => node.cleared)).toEqual([entrance]);
      const support = nodes.filter((node) =>
        LABYRINTH_SUPPORT_TYPES.includes(node.type as (typeof LABYRINTH_SUPPORT_TYPES)[number]),
      );
      expect(support.length).toBeGreaterThanOrEqual(3);
      expect(new Set(support.map((node) => node.type)).size).toBe(support.length);
      for (const node of nodes) {
        if (["combat", "elite", "boss"].includes(node.type)) {
          expect(node.enemyId).toBeTruthy();
          expect(node.modifiers).toHaveLength(node.type === "combat" ? 1 : 2);
          expect(node.rewardModifiers).toHaveLength(1);
        } else if (node.type !== "entrance") {
          expect(node.enemyId).toBeUndefined();
          expect(node.modifiers).toEqual([]);
          expect(node.rewardModifiers).toHaveLength(1);
        }
      }
    }
    expect(starts.size).toBe(4);
  });

  it("is deterministic per seed and varies across seeds", () => {
    expect(generateLabyrinthMap(createSeededRng(42))).toEqual(generateLabyrinthMap(createSeededRng(42)));
    expect(generateLabyrinthMap(createSeededRng(42))).not.toEqual(generateLabyrinthMap(createSeededRng(7)));
  });

  it("allows a five-to-six-step boss route, retains detours, and descends only once", () => {
    const rng = createSeededRng(42);
    const original = generateLabyrinthMap(rng);
    const nodes = floorNodes(original, 1);
    const boss = nodes.find((node) => node.type === "boss")!;
    let map = original;
    let steps = 0;
    while (map.currentNodeId !== boss.id) {
      const position = map.nodes[map.currentNodeId]!.gridPosition;
      const nextPosition =
        position.row < boss.gridPosition.row
          ? { ...position, row: position.row + 1 }
          : { ...position, col: position.col + Math.sign(boss.gridPosition.col - position.col) };
      const next = nodes.find((node) => gridKey(node.gridPosition) === gridKey(nextPosition))!;
      expect(canEnterLabyrinthNode(map, next.id)).toBe(true);
      map = withClearedNode(map, next.id);
      steps += 1;
    }
    expect(steps).toBeGreaterThanOrEqual(5);
    expect(steps).toBeLessThanOrEqual(6);
    expect(map.currentFloor).toBe(1);
    const completed = map;
    const next = expandBeyondBoss(map, boss.id, rng);
    expect(next.currentFloor).toBe(2);
    expect(next.floors).toHaveLength(2);
    expect(next.nodes[next.currentNodeId]!.type).toBe("entrance");
    expect(next.nodes[next.currentNodeId]!.floor).toBe(2);
    expect(floorNodes(next, 1)).toEqual(floorNodes(completed, 1));
    expect(floorNodes(next, 1).filter((node) => !node.cleared).length).toBeGreaterThan(0);
    expect(expandBeyondBoss(next, boss.id, rng)).toBe(next);
    const revisit = { ...next, currentFloor: 1, currentNodeId: boss.id };
    expect(
      expandBeyondBoss(revisit, boss.id, () => {
        throw new Error("Must reuse the generated floor");
      }),
    ).toEqual(next);
    expect(original.nodes[boss.id]!.cleared).toBe(false);
    expect(expandBeyondBoss(original, boss.id, rng)).toBe(original);
  });
});

describe("labyrinth type seating", () => {
  function sameTypeAdjacencies(
    types: readonly LabyrinthNodeType[],
    positions: readonly LabyrinthGridPosition[],
  ): number {
    let conflicts = 0;
    for (let first = 0; first < types.length; first += 1) {
      for (let second = first + 1; second < types.length; second += 1) {
        if (types[first] === types[second] && areGridNeighbors(positions[first]!, positions[second]!)) {
          conflicts += 1;
        }
      }
    }
    return conflicts;
  }

  it("separates duplicate types when the layout allows it", () => {
    const positions: LabyrinthGridPosition[] = [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 3, col: 0 },
    ];
    const types: LabyrinthNodeType[] = ["combat", "rest", "combat", "boss"];
    const result = orderTypesForPositions(types, positions, createSeededRng(7));
    expect(result[0]).toBe("combat");
    expect(result[result.length - 1]).toBe("boss");
    expect([...result].sort()).toEqual([...types].sort());
    expect(sameTypeAdjacencies(result, positions)).toBe(0);
  });

  it("separates repeated non-combat types without per-type logic", () => {
    const positions: LabyrinthGridPosition[] = [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 3, col: 0 },
      { row: 4, col: 0 },
    ];
    const types: LabyrinthNodeType[] = ["combat", "mystery", "combat", "mystery", "boss"];
    const result = orderTypesForPositions(types, positions, createSeededRng(11));
    expect([...result].sort()).toEqual([...types].sort());
    expect(sameTypeAdjacencies(result, positions)).toBe(0);
    const mysteries = result.map((type, index) => (type === "mystery" ? index : -1)).filter((index) => index >= 0);
    expect(mysteries).toHaveLength(2);
    expect(areGridNeighbors(positions[mysteries[0]!]!, positions[mysteries[1]!]!)).toBe(false);
  });

  it("still seats every planned type when separation is impossible", () => {
    const positions: LabyrinthGridPosition[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
    ];
    const types: LabyrinthNodeType[] = ["combat", "combat", "combat"];
    const result = orderTypesForPositions(types, positions, createSeededRng(3));
    expect(result).toEqual(["combat", "combat", "combat"]);
  });
});
