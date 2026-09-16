import { describe, expect, it } from "vitest";
import {
  applyEmptySlotEquip,
  applyHandConflicts,
  applyReplace,
  applyUnequip,
  clampPage,
  defaultGearCompare,
  nameGearCompare,
  reconcileWorkingList,
  trinketCompare,
} from "@/features/alchemy/meta/screens/armory/armory-ordering";
import type { TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";

describe("armory-ordering", () => {
  const uniqueSword: GearInstance = {
    instanceId: "sword-unique-1",
    definitionId: "oathkeeper",
    affixes: [],
  };
  const astralSword: GearInstance = {
    instanceId: "sword-astral-1",
    definitionId: "longsword-astral",
    affixes: [],
  };
  const basicSwordA: GearInstance = {
    instanceId: "sword-basic-a",
    definitionId: "longsword-basic",
    affixes: [],
  };
  const basicSwordB: GearInstance = {
    instanceId: "sword-basic-b",
    definitionId: "longsword-basic",
    affixes: [],
  };
  const basicHatchet: GearInstance = {
    instanceId: "hatchet-basic-1",
    definitionId: "hatchet-basic",
    affixes: [],
  };

  describe("defaultGearCompare", () => {
    it("sorts Unique -> Astral -> Basic, then displayed name A-Z, then instanceId", () => {
      const items = [basicSwordB, basicHatchet, uniqueSword, basicSwordA, astralSword];
      const sorted = [...items].sort(defaultGearCompare);
      expect(sorted.map((i) => i.instanceId)).toEqual([
        "sword-unique-1", // Unique (Oathkeeper)
        "sword-astral-1", // Astral (Astral Longsword)
        "hatchet-basic-1", // Basic (Hatchet)
        "sword-basic-a", // Basic (Longsword, id 'a')
        "sword-basic-b", // Basic (Longsword, id 'b')
      ]);
    });
  });

  describe("nameGearCompare", () => {
    it("sorts by displayed name A-Z, then rarity, then instanceId", () => {
      const items = [basicSwordA, basicHatchet, astralSword, uniqueSword];
      const sorted = [...items].sort(nameGearCompare);
      // Names:
      // astralSword -> "Astral Longsword"
      // basicHatchet -> "Hatchet"
      // basicSwordA -> "Longsword"
      // uniqueSword -> "Oathkeeper"
      expect(sorted.map((i) => i.instanceId)).toEqual([
        "sword-astral-1",
        "hatchet-basic-1",
        "sword-basic-a",
        "sword-unique-1",
      ]);
    });
  });

  describe("trinketCompare", () => {
    it("sorts by title A-Z, then ID tie-breaker", () => {
      const trinketA: TrinketEntry = {
        id: "trinket-a",
        title: "Amber Charm",
        art: "",
        descriptionLines: [],
        effects: {},
      };
      const trinketB: TrinketEntry = {
        id: "trinket-b",
        title: "Amber Charm",
        art: "",
        descriptionLines: [],
        effects: {},
      };
      const trinketC: TrinketEntry = {
        id: "trinket-c",
        title: "Ruby Ring",
        art: "",
        descriptionLines: [],
        effects: {},
      };
      const sorted = [trinketC, trinketB, trinketA].sort(trinketCompare);
      expect(sorted.map((t) => t.id)).toEqual(["trinket-a", "trinket-b", "trinket-c"]);
    });
  });

  describe("clampPage", () => {
    it("returns 0 for empty inventories", () => {
      expect(clampPage(2, 0, 6)).toBe(0);
    });

    it("clamps page when items shrink", () => {
      // 7 items = 2 pages (page 0 and 1)
      expect(clampPage(1, 7, 6)).toBe(1);
      // If items shrink to 6, max page is 0
      expect(clampPage(1, 6, 6)).toBe(0);
    });

    it("does not allow negative pages", () => {
      expect(clampPage(-1, 10, 6)).toBe(0);
    });
  });

  describe("reconcileWorkingList", () => {
    it("preserves surviving order, removes missing IDs, and appends newly available items deterministically", () => {
      const currentIds = ["item-2", "item-1", "item-removed"];
      const availablePool = [
        { id: "item-1", name: "Zebra" },
        { id: "item-2", name: "Alpha" },
        { id: "item-3", name: "Beta" },
        { id: "item-4", name: "Apple" },
      ];
      const compare = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

      const reconciled = reconcileWorkingList(currentIds, availablePool, compare);
      // Surviving: item-2, item-1 (item-removed is dropped)
      // New: item-3, item-4 sorted by name -> item-4 (Apple), item-3 (Beta)
      expect(reconciled).toEqual(["item-2", "item-1", "item-4", "item-3"]);
    });
  });

  describe("applyReplace", () => {
    it("swaps replaced item into incoming item's exact inventory position", () => {
      const currentIds = ["item-0", "item-1", "item-2", "item-3"];
      const result = applyReplace(currentIds, "item-2", "item-equipped");
      expect(result).toEqual(["item-0", "item-1", "item-equipped", "item-3"]);
    });

    it("appends replaced item if incoming item was somehow not in list", () => {
      const currentIds = ["item-0", "item-1"];
      const result = applyReplace(currentIds, "item-missing", "item-equipped");
      expect(result).toEqual(["item-0", "item-1", "item-equipped"]);
    });
  });

  describe("applyEmptySlotEquip", () => {
    it("removes incoming item and closes gap", () => {
      const currentIds = ["item-0", "item-1", "item-2", "item-3"];
      const result = applyEmptySlotEquip(currentIds, "item-1");
      expect(result).toEqual(["item-0", "item-2", "item-3"]);
    });
  });

  describe("applyUnequip", () => {
    it("inserts unequipped item at the beginning of current page", () => {
      // Page 0 (items 0..5): insert at index 0
      const currentIds = ["item-0", "item-1", "item-2", "item-3", "item-4", "item-5", "item-6"];
      const resultPage0 = applyUnequip(currentIds, "unequipped-item", 0, 6);
      expect(resultPage0[0]).toBe("unequipped-item");
      expect(resultPage0.slice(1)).toEqual(currentIds);

      // Page 1 (items 6..11): insert at index 6
      const resultPage1 = applyUnequip(currentIds, "unequipped-item", 1, 6);
      expect(resultPage1[6]).toBe("unequipped-item");
      expect(resultPage1.slice(0, 6)).toEqual(currentIds.slice(0, 6));
      expect(resultPage1.slice(7)).toEqual(currentIds.slice(6));
    });
  });

  describe("applyHandConflicts", () => {
    it("places replaced target item at incoming index, and compatible displaced items immediately after", () => {
      const currentIds = ["sword-1", "bow-1", "axe-1"];
      // Knight equips 2H sword replacing 1H sword at index 1 ("bow-1")
      // Displaced from off-hand: a 1H dagger (compatible with main-hand)
      const dagger: GearInstance = {
        instanceId: "dagger-1",
        definitionId: "dagger-basic",
        affixes: [],
      };
      const result = applyHandConflicts(
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
      const result = applyHandConflicts(
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
      const result = applyHandConflicts(
        currentIds,
        "bow-1",
        null,
        [{ slot: "off-hand", instance: dagger }],
        "main-hand",
      );
      expect(result).toEqual(["sword-1", "dagger-1", "axe-1"]);
    });
  });
});
