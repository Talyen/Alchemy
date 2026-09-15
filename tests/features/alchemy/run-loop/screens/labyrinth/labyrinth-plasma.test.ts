import { describe, expect, it } from "vitest";
import type { LabyrinthNode } from "@/lib/content-systems/types";
import { getPlasmaColorPair } from "@/features/alchemy/shared/config/plasma-palettes";
import { getLabyrinthNodePlasmaPair } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-plasma";

function makeNode(overrides: Partial<LabyrinthNode> = {}): LabyrinthNode {
  return {
    id: "node-1",
    type: "combat",
    floor: 0,
    gridPosition: { row: 0, col: 0 },
    modifiers: [],
    rewardModifiers: [],
    cleared: false,
    ...overrides,
  };
}

describe("labyrinth node plasma", () => {
  it("returns no pair for the entrance", () => {
    expect(getLabyrinthNodePlasmaPair(makeNode({ type: "entrance" }))).toBeNull();
  });

  it("resolves a pair for combat, rest, and boss nodes", () => {
    expect(getLabyrinthNodePlasmaPair(makeNode({ type: "combat" }))).not.toBeNull();
    expect(getLabyrinthNodePlasmaPair(makeNode({ type: "rest" }))).not.toBeNull();
    expect(getLabyrinthNodePlasmaPair(makeNode({ type: "boss" }))).not.toBeNull();
  });

  it("falls back to the physical palette for unknown enemies", () => {
    // Boss nodes always derive from keywords (never destination metadata), so
    // an unknown enemy exercises the documented physical fallback.
    const pair = getLabyrinthNodePlasmaPair(makeNode({ type: "boss", enemyId: "no-such-enemy" }));
    expect(pair).toEqual(getPlasmaColorPair(["physical"]));
  });

  it("is deterministic for the same node", () => {
    const node = makeNode({ type: "boss", modifiers: ["tempered"] });
    expect(getLabyrinthNodePlasmaPair(node)).toEqual(getLabyrinthNodePlasmaPair({ ...node }));
  });
});
