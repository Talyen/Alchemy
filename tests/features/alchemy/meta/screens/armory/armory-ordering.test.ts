import { describe, expect, it } from "vitest";
import { placeTransfer, reconcileOrder } from "@/features/alchemy/meta/screens/armory/armory-ordering";
import type { GearInstance } from "@/lib/gear";

describe("armory-ordering", () => {
  describe("reconcileOrder", () => {
    it("preserves surviving order, removes missing IDs, and appends newly available rows deterministically", () => {
      const currentIds = ["item-2", "item-1", "item-2", "item-removed"];
      const rows = [
        { id: "item-1", title: "Zebra", rank: 0, baseType: "" },
        { id: "item-2", title: "Alpha", rank: 0, baseType: "" },
        { id: "item-3", title: "Beta", rank: 0, baseType: "" },
        { id: "item-4", title: "Apple", rank: 0, baseType: "" },
        { id: "item-3", title: "Beta", rank: 0, baseType: "" },
      ];

      const reconciled = reconcileOrder(currentIds, rows);
      // Surviving: item-2, item-1 (item-removed is dropped)
      // New: item-3, item-4 sorted by title -> item-4 (Apple), item-3 (Beta)
      expect(reconciled).toEqual(["item-2", "item-1", "item-4", "item-3"]);
    });
  });

  describe("placeTransfer", () => {
    it("appends replaced item if incoming item was somehow not in list", () => {
      const currentIds = ["item-0", "item-1"];
      const result = placeTransfer(currentIds, "item-missing", "item-equipped", [], "main-hand");
      expect(result).toEqual(["item-0", "item-1", "item-equipped"]);
    });

    it("moves already-visible displaced items beside the replacement without duplication or input mutation", () => {
      const currentIds = ["dagger-1", "sword-1", "bow-1", "axe-1"];
      const dagger: GearInstance = { instanceId: "dagger-1", definitionId: "dagger-basic", affixes: [] };
      expect(
        placeTransfer(currentIds, "bow-1", "replaced-main-hand", [{ slot: "off-hand", instance: dagger }], "main-hand"),
      ).toEqual(["sword-1", "replaced-main-hand", "dagger-1", "axe-1"]);
      expect(currentIds).toEqual(["dagger-1", "sword-1", "bow-1", "axe-1"]);
    });

    it("excludes displaced items incompatible with current category", () => {
      const currentIds = ["sword-1", "bow-1", "axe-1"];
      // Displaced from off-hand: a shield (only compatible with off-hand)
      const shield: GearInstance = {
        instanceId: "shield-1",
        definitionId: "leather-buckler-basic",
        affixes: [],
      };
      const result = placeTransfer(
        currentIds,
        "bow-1",
        "replaced-main-hand",
        [{ slot: "off-hand", instance: shield }],
        "main-hand",
      );
      expect(result).toEqual(["sword-1", "replaced-main-hand", "axe-1"]);
    });

    it("places compatible displaced item at incoming index when equipping into an empty slot", () => {
      const currentIds = ["sword-1", "bow-1", "axe-1"];
      const dagger: GearInstance = {
        instanceId: "dagger-1",
        definitionId: "dagger-basic",
        affixes: [],
      };
      const result = placeTransfer(currentIds, "bow-1", null, [{ slot: "off-hand", instance: dagger }], "main-hand");
      expect(result).toEqual(["sword-1", "dagger-1", "axe-1"]);
    });
  });
});
