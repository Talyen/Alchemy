import { describe, it, expect } from "vitest";
import {
  BattleCardEffectSchema,
  LabyrinthMapSchema,
  MaterialInventorySchema,
  CompletedDifficultiesSchema,
  UnlockedTalentsSchema,
} from "@/lib/validation";
import { createSeededRng } from "@/lib/utils";
import { deduplicateFromSet, deduplicatedSetArraySchema } from "@/lib/validation/save-schemas/validation-utils";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { withClearedNode } from "@/lib/content-systems/labyrinth/map-state";
import { canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-state";

describe("BattleCardEffectSchema", () => {
  it.each([
    ["damage effect", { kind: "damage", damageType: "physical", amount: 6 }],
    ["player-status effect", { kind: "player-status", status: "block", amount: 8 }],
    ["heal effect", { kind: "heal", amount: 5 }],
    ["summon-companion", { kind: "summon-companion", companionId: "wolf" }],
    ["self-damage with enemy status damage type", { kind: "self-damage", damageType: "burn", amount: 3 }],
    ["remove-player-status", { kind: "remove-player-status", status: "poison" }],
    ["lose-health", { kind: "lose-health", amount: 1 }],
    ["draw-cards", { kind: "draw-cards", amount: 2 }],
    ["remove-enemy-armor", { kind: "remove-enemy-armor", amount: 2 }],
    ["multiply-enemy-status", { kind: "multiply-enemy-status", status: "freeze", factor: 2 }],
  ])("parses %s", (_label, effect) => {
    const result = BattleCardEffectSchema.safeParse(effect);
    expect(result.success).toBe(true);
  });

  it("rejects unknown kind", () => {
    const result = BattleCardEffectSchema.safeParse({ kind: "unknown", amount: 5 });
    expect(result.success).toBe(false);
  });
});

describe("LabyrinthMapSchema", () => {
  it("parses null as null", () => {
    const result = LabyrinthMapSchema.safeParse(null);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("catches invalid input", () => {
    const result = LabyrinthMapSchema.safeParse({ grid: "invalid" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

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
  it("ensures all material keys exist", () => {
    const result = MaterialInventorySchema.safeParse({ wood: 5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wood).toBe(5);
      expect(result.data.iron).toBe(0);
      expect(result.data.herbs).toBe(0);
      expect(result.data.food).toBe(0);
      expect(result.data.crystal).toBe(0);
    }
  });

  it("rejects negative values", () => {
    const result = MaterialInventorySchema.safeParse({ wood: -5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wood).toBe(0);
    }
  });
});

describe("UnlockedTalentsSchema", () => {
  it("drops mismatched, unknown, and placeholder talent ids", () => {
    const result = UnlockedTalentsSchema.safeParse({
      physical: ["physical-brute-force", "burn-dmg-1", "unknown-talent"],
      consume: ["consume-6"],
      burn: ["burn-dmg-1"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        physical: ["physical-brute-force"],
        burn: ["burn-dmg-1"],
      });
    }
  });

  it("filters non-array entries", () => {
    const result = UnlockedTalentsSchema.safeParse({ burn: "bad" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.burn).toBeUndefined();
    }
  });

  it("falls back for non-object input", () => {
    const result = UnlockedTalentsSchema.safeParse(null);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({});
    }
  });
});

describe("CompletedDifficultiesSchema", () => {
  it("ensures all character keys exist", () => {
    const result = CompletedDifficultiesSchema.safeParse({ knight: ["difficulty-1"] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.knight).toEqual(["difficulty-1"]);
      expect(result.data.rogue).toEqual([]);
      expect(result.data.wizard).toEqual([]);
      expect(result.data.ranger).toEqual([]);
      expect(result.data.alchemist).toEqual([]);
      expect(result.data.warlock).toEqual([]);
      expect(result.data.druid).toEqual([]);
      expect(result.data.wildcard).toEqual([]);
    }
  });
});

describe("deduplicateFromSet and deduplicatedSetArraySchema", () => {
  it("deduplicates and filters unknown elements against valid set", () => {
    const valid = ["a", "b", "c"] as const;
    expect(deduplicateFromSet(["a", "b", "a", "d", 123, null], valid)).toEqual(["a", "b"]);
    expect(deduplicateFromSet("not an array", valid)).toEqual([]);
  });

  it("parses valid array and falls back safely using schema", () => {
    const schema = deduplicatedSetArraySchema(["knight", "rogue"] as const);
    expect(schema.parse(["knight", "rogue", "knight", "unknown"])).toEqual(["knight", "rogue"]);
    expect(schema.parse("invalid")).toEqual([]);
    expect(schema.parse(null)).toEqual([]);
  });
});
