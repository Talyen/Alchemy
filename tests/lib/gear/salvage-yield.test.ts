import { expect, it } from "vitest";
import { gearBaseItemList, GEAR_RARITIES } from "@/lib/gear";
import { MATERIAL_IDS } from "@/lib/homestead/types";

it("salvages every base into materials, with no food and no lost payout from Astral quality", () => {
  for (const item of gearBaseItemList) {
    for (const rarity of GEAR_RARITIES) {
      const materials = item.salvageByRarity[rarity];
      expect(
        Object.values(materials).some((amount) => amount > 0),
        `${item.id}/${rarity}`,
      ).toBe(true);
      expect(materials.food, `${item.id}/${rarity}`).toBe(0);
    }
    for (const material of MATERIAL_IDS) {
      expect(item.salvageByRarity.basic[material], `${item.id}/${material}`).toBeGreaterThanOrEqual(0);
      expect(item.salvageByRarity.astral[material], `${item.id}/${material}`).toBeGreaterThanOrEqual(
        item.salvageByRarity.basic[material],
      );
    }
  }
});
