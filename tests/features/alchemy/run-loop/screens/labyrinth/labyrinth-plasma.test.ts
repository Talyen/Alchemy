import { describe, expect, it } from "vitest";
import type { LabyrinthNode } from "@/lib/content-systems/types";
import { getPlasmaColorPair } from "@/features/alchemy/shared/config/plasma-palettes";
import { getLabyrinthNodePlasmaPair } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-plasma";
import { phoenixFeatherStatus } from "@/features/alchemy/shared/config/phoenix-feather-status";
import { getEncounterTraitPresentation } from "@/features/alchemy/shared/config/encounter-trait-presentation";

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

  it("keeps Phoenix Nest's feather presentation without a Phoenix keyword", () => {
    const trait = getEncounterTraitPresentation("phoenix-nest");
    expect(trait?.keywords).toEqual([]);
    expect(trait?.Icon).toBe(phoenixFeatherStatus.icon);
    expect(getLabyrinthNodePlasmaPair(makeNode({ type: "boss", rewardModifiers: ["phoenix-nest"] }))).toEqual({
      primary: phoenixFeatherStatus.shineColors[0],
      secondary: phoenixFeatherStatus.shineColors[1],
    });
    expect(
      getLabyrinthNodePlasmaPair(
        makeNode({ type: "boss", modifiers: ["tempered"], rewardModifiers: ["phoenix-nest"] }),
      ),
    ).toEqual({
      primary: getPlasmaColorPair(["forge"])?.primary,
      secondary: phoenixFeatherStatus.shineColors[0],
    });
  });

  it("is deterministic for the same node", () => {
    const node = makeNode({ type: "boss", modifiers: ["tempered"] });
    expect(getLabyrinthNodePlasmaPair(node)).toEqual(getLabyrinthNodePlasmaPair({ ...node }));
  });
});
