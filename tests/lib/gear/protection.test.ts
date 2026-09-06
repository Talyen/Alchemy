import { describe, expect, it } from "vitest";
import {
  applyCraftingCurrency,
  canApplyCraftingCurrency,
  computeSalvageYield,
  normalizeGearInstance,
  salvageGear,
} from "@/lib/gear";
import { gearProtectionSaveFixture } from "../../fixtures/gear-protection";
import { normalizeSaveData } from "../../helpers/parse-save-for-tests";

describe("protected gear and stable salvage", () => {
  it("loads older gear unlocked and preserves protected equipment through save normalization", () => {
    const save = normalizeSaveData(gearProtectionSaveFixture());
    const [legacy, protectedItem] = save.gearInventories.knight;
    expect(legacy.protected).not.toBe(true);
    expect(protectedItem.protected).toBe(true);
    expect(save.gearLoadouts.knight["main-hand"]).toBe(protectedItem.instanceId);
    expect(normalizeSaveData(JSON.parse(JSON.stringify(save)))).toEqual(save);
    expect(salvageGear(save.gearInventories.knight, save.gearLoadouts, protectedItem.instanceId)).toBeNull();
    expect(canApplyCraftingCurrency("voidstone", protectedItem)).toBe(false);
    expect(applyCraftingCurrency("voidstone", protectedItem, () => 0)).toBe(protectedItem);
    expect(salvageGear(save.gearInventories.knight, save.gearLoadouts, legacy.instanceId)?.inventory).toEqual([
      protectedItem,
    ]);
  });

  it("preserves preview rewards across reopen, reload, protection, and affix changes", () => {
    const save = normalizeSaveData(gearProtectionSaveFixture());
    const item = save.gearInventories.knight[0];
    const preview = computeSalvageYield(item);
    expect(computeSalvageYield(item)).toEqual(preview);
    const reloaded = normalizeGearInstance(JSON.parse(JSON.stringify(item)))!;
    expect(computeSalvageYield(reloaded)).toEqual(preview);
    expect(computeSalvageYield({ ...item, protected: true, affixes: [{ id: "flat-physical", value: 2 }] })).toEqual(
      preview,
    );
    const confirmed = salvageGear(save.gearInventories.knight, save.gearLoadouts, item.instanceId);
    expect(confirmed?.yieldedCurrencies).toEqual(preview.currencies);
    expect(confirmed?.yieldedMaterials).toEqual(preview.materials);
  });
});
