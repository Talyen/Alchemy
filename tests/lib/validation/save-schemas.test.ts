import { describe, it, expect } from "vitest";
import {
  LabyrinthMapSchema,
  MaterialInventorySchema,
  CompletedDifficultiesSchema,
  UnlockedTalentsSchema,
} from "@/lib/validation";
import { createSeededRng } from "@/lib/rng";
import { deduplicateFromSet, deduplicatedSetArraySchema } from "@/lib/validation/save-schemas/validation-utils";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { withClearedNode } from "@/lib/content-systems/labyrinth/map-state";
import { canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-state";
import { CHARACTER_IDS } from "@/lib/validation/save-schemas/schema-enums";
import { emptyInventory } from "@/lib/homestead/inventory";

describe("LabyrinthMapSchema", () => {
  it("roundtrips seeded grid geography", () => {
    for (const seed of [1, 42, 99]) {
      const map = generateLabyrinthMap(createSeededRng(seed));
      expect(LabyrinthMapSchema.parse(JSON.parse(JSON.stringify(map)))).toEqual(map);
    }
  });

  it("parses a map after a node is cleared", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    const entryId = Object.values(map.nodes).find((node) => canEnterLabyrinthNode(map, node.id))!.id;
    const next = withClearedNode(map, entryId);
    const result = LabyrinthMapSchema.safeParse(next);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    expect(result.data?.currentNodeId).toBe(entryId);
    const legacy = { ...next, currentNodeId: undefined };
    expect(LabyrinthMapSchema.parse(legacy)).toEqual({ ...next, currentNodeId: map.currentNodeId });
    expect(LabyrinthMapSchema.parse({ ...next, currentNodeId: "missing" })).toEqual({
      ...next,
      currentNodeId: map.currentNodeId,
    });
  });

  it("catches a map with no entrance", () => {
    const map = generateLabyrinthMap(createSeededRng(42));
    delete map.nodes[map.currentNodeId];
    const result = LabyrinthMapSchema.safeParse(map);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });
});

describe("MaterialInventorySchema", () => {
  it("repairs corrupt materials without discarding usable inventory", () => {
    expect(MaterialInventorySchema.parse({ wood: 5, iron: -1, herbs: "bad", gems: Number.NaN })).toEqual({
      ...emptyInventory(),
      wood: 5,
    });
  });
});

describe("UnlockedTalentsSchema", () => {
  it("drops mismatched, unknown, and placeholder talent ids", () => {
    const result = UnlockedTalentsSchema.safeParse({
      physical: ["physical-brute-force", "burn-dmg-1", "unknown-talent"],
      consume: ["consume-6"],
      burn: ["burn-dmg-1"],
      armor: "bad",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        physical: ["physical-brute-force"],
        burn: ["burn-dmg-1"],
      });
    }
  });
});

describe("CompletedDifficultiesSchema", () => {
  it("preserves earned unlocks while repairing individual heroes and excluding inherited progress", () => {
    const saved = Object.assign(Object.create({ ranger: ["difficulty-2"] }), {
      knight: ["difficulty-2", 42, "unknown", "difficulty-1", "difficulty-2"],
      rogue: "bad",
      wizard: ["difficulty-3"],
      stranger: ["difficulty-1"],
    });
    const defaults = Object.fromEntries(CHARACTER_IDS.map((id) => [id, []]));
    expect(CompletedDifficultiesSchema.parse(saved)).toEqual({
      ...defaults,
      knight: ["difficulty-2", "difficulty-1"],
      wizard: ["difficulty-3"],
    });
    const first = CompletedDifficultiesSchema.parse(null);
    first.knight.push("difficulty-1");
    expect(CompletedDifficultiesSchema.parse(null)).toEqual(defaults);
  });
});

describe("deduplicateFromSet and deduplicatedSetArraySchema", () => {
  it("repairs malformed discovery IDs in first-seen order for both catalog forms", () => {
    const ids = ["knight", "rogue"] as const;
    const saved = ["rogue", null, "knight", "rogue", 42, "unknown", "toString"];
    for (const valid of [ids, new Set(ids)]) {
      expect(deduplicateFromSet(saved, valid)).toEqual(["rogue", "knight"]);
      const schema = deduplicatedSetArraySchema(valid);
      expect(schema.parse(saved)).toEqual(["rogue", "knight"]);
      expect(schema.parse(null)).toEqual([]);
    }
    expect(saved).toEqual(["rogue", null, "knight", "rogue", 42, "unknown", "toString"]);
  });
});
