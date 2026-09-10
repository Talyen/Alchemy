import { describe, expect, it } from "vitest";
import {
  canDescendFromLabyrinthNode,
  canEnterLabyrinthNode,
  canInspectLabyrinthNode,
  isNodeDiscovered,
  labyrinthNodeVisualState,
  withClearedNode,
} from "@/lib/content-systems/labyrinth/map-state";
import { gridLabyrinthMapFixture, twoFloorLabyrinthMapFixture } from "../../../fixtures/labyrinth-map";

const entrance = "labyrinth-floor-1-entrance";
const east = "labyrinth-floor-1-n0";
const south = "labyrinth-floor-1-n3";
const diagonal = "labyrinth-floor-1-n4";
const boss = "labyrinth-floor-1-n14";

describe("Labyrinth discovery and movement", () => {
  it("reveals only the entrance, cardinal neighbors and boss at floor entry", () => {
    const map = gridLabyrinthMapFixture();
    const discovered = Object.keys(map.nodes).filter((id) => isNodeDiscovered(map, id));
    expect(discovered.sort()).toEqual([entrance, east, south, boss].sort());
    expect(canEnterLabyrinthNode(map, east)).toBe(true);
    expect(canEnterLabyrinthNode(map, south)).toBe(true);
    expect(canInspectLabyrinthNode(map, boss)).toBe(true);
    expect(canEnterLabyrinthNode(map, boss)).toBe(false);
    expect(canInspectLabyrinthNode(map, diagonal)).toBe(false);
    expect(labyrinthNodeVisualState(map, diagonal)).toBe("undiscovered");
  });

  it("allows entry from every completed branch while keeping hidden rooms inaccessible", () => {
    const original = gridLabyrinthMapFixture();
    const map = withClearedNode(original, east);
    expect(map.currentNodeId).toBe(east);
    expect(original.nodes[east]!.cleared).toBe(false);
    expect(isNodeDiscovered(map, diagonal)).toBe(true);
    expect(canEnterLabyrinthNode(map, diagonal)).toBe(true);
    expect(canEnterLabyrinthNode(map, south)).toBe(true);
    expect(labyrinthNodeVisualState(map, south)).toBe("reachable");
    const otherBranch = withClearedNode(map, south);
    expect(otherBranch.currentNodeId).toBe(south);
    expect(otherBranch.nodes[east]!.cleared).toBe(true);
    expect(isNodeDiscovered(otherBranch, "labyrinth-floor-1-side-1--1")).toBe(true);
    expect(canEnterLabyrinthNode(otherBranch, "labyrinth-floor-1-n1")).toBe(true);
    expect(isNodeDiscovered(otherBranch, "labyrinth-floor-1-n6")).toBe(false);
  });

  it("rejects hidden, completed, missing and prior-floor entry", () => {
    const map = twoFloorLabyrinthMapFixture();
    const current = map.currentNodeId;
    expect(canInspectLabyrinthNode(map, east)).toBe(false);
    expect(canEnterLabyrinthNode(map, east)).toBe(false);
    expect(withClearedNode(map, east)).toBe(map);
    expect(withClearedNode(map, "labyrinth-floor-2-n14")).toBe(map);
    expect(withClearedNode(map, current)).toBe(map);
    expect(withClearedNode(map, "missing")).toBe(map);
  });

  it("allows descent from a completed boss without backtracking", () => {
    const map = gridLabyrinthMapFixture();
    expect(canDescendFromLabyrinthNode(map, boss)).toBe(false);
    map.nodes[boss]!.cleared = true;
    expect(canDescendFromLabyrinthNode(map, boss)).toBe(true);
  });
});
