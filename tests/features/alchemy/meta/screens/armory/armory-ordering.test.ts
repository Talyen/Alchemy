import { describe, expect, it } from "vitest";
import { placeTransfer, placeUnequip, reconcileOrder } from "@/features/alchemy/meta/screens/armory/armory-ordering";
import type { GearInstance } from "@/lib/gear";

describe("armory-ordering", () => {
  describe("reconcileOrder", () => {
    it("preserves surviving order, removes missing IDs, and appends newly available rows deterministically", () => {
      const currentIds = ["item-2", "item-1", "item-removed"];
      const rows = [
        { id: "item-1", title: "Zebra", rank: 0, baseType: "" },
        { id: "item-2", title: "Alpha", rank: 0, baseType: "" },
        { id: "item-3", title: "Beta", rank: 0, baseType: "" },
        { id: "item-4", title: "Apple", rank: 0, baseType: "" },
      ];

      const reconciled = reconcileOrder(currentIds, rows);
      // Surviving: item-2, item-1 (item-removed is dropped)
      // New: item-3, item-4 sorted by title -> item-4 (Apple), item-3 (Beta)
      expect(reconciled).toEqual(["item-2", "item-1", "item-4", "item-3"]);
    });
  });

  describe("placeTransfer", () => {
    it("swaps replaced item into incoming item's exact inventory position", () => {
      const currentIds = ["item-0", "item-1", "item-2", "item-3"];
      const result = placeTransfer(currentIds, "item-2", "item-equipped", [], "main-hand");
      expect(result).toEqual(["item-0", "item-1", "item-equipped", "item-3"]);
    });

    it("appends replaced item if incoming item was somehow not in list", () => {
      const currentIds = ["item-0", "item-1"];
      const result = placeTransfer(currentIds, "item-missing", "item-equipped", [], "main-hand");
      expect(result).toEqual(["item-0", "item-1", "item-equipped"]);
    });

    it("removes incoming item and closes gap when equipping into an empty slot", () => {
      const currentIds = ["item-0", "item-1", "item-2", "item-3"];
      const result = placeTransfer(currentIds, "item-1", null, [], "main-hand");
      expect(result).toEqual(["item-0", "item-2", "item-3"]);
    });

    it("moves already-visible displaced items beside the replacement without duplication or input mutation", () => {
      const currentIds = ["dagger-1", "sword-1", "bow-1", "axe-1"];
      const dagger: GearInstance = { instanceId: "dagger-1", definitionId: "dagger-basic", affixes: [] };
      expect(
        placeTransfer(currentIds, "bow-1", "replaced-main-hand", [{ slot: "off-hand", instance: dagger }], "main-hand"),
      ).toEqual(["sword-1", "replaced-main-hand", "dagger-1", "axe-1"]);
      expect(currentIds).toEqual(["dagger-1", "sword-1", "bow-1", "axe-1"]);
    });

    it("places replaced target item at incoming index, and compatible displaced items immediately after", () => {
      const currentIds = ["sword-1", "bow-1", "axe-1"];
      // Knight equips 2H sword replacing 1H sword at index 1 ("bow-1")
      // Displaced from off-hand: a 1H dagger (compatible with main-hand)
      const dagger: GearInstance = {
        instanceId: "dagger-1",
        definitionId: "dagger-basic",
        affixes: [],
      };
      const result = placeTransfer(
        currentIds,
        "bow-1",
        "replaced-main-hand",
        [{ slot: "off-hand", instance: dagger }],
        "main-hand",
      );
      expect(result).toEqual(["sword-1", "replaced-main-hand", "dagger-1", "axe-1"]);
    });

    it("excludes displaced items incompatible with current category", () => {
      const currentIds = ["sword-1", "bow-1", "axe-1"];
      // Displaced from off-hand: a shield (only compatible with off-hand)
      const shield: GearInstance = {
        instanceId: "shield-1",
        definitionId: "shield-basic",
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

  describe("placeUnequip", () => {
    it("inserts unequipped item at the beginning of current page", () => {
      // Page 0 (items 0..5): insert at index 0
      const currentIds = ["item-0", "item-1", "item-2", "item-3", "item-4", "item-5", "item-6"];
      const resultPage0 = placeUnequip(currentIds, "unequipped-item", 0, 6);
      expect(resultPage0[0]).toBe("unequipped-item");
      expect(resultPage0.slice(1)).toEqual(currentIds);

      // Page 1 (items 6..11): insert at index 6
      const resultPage1 = placeUnequip(currentIds, "unequipped-item", 1, 6);
      expect(resultPage1[6]).toBe("unequipped-item");
      expect(resultPage1.slice(0, 6)).toEqual(currentIds.slice(0, 6));
      expect(resultPage1.slice(7)).toEqual(currentIds.slice(6));
    });
  });
});
