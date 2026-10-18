import { describe, expect, it } from "vitest";
import {
  combineTrinketEffectIds,
  computeTrinketManifest,
  defaultTrinketEffects,
  getTrinketEffectValue,
} from "@/lib/trinkets";

describe("Trinket manifests", () => {
  it("combines a boolean Boon and a numeric Boon without sharing mutable defaults", () => {
    const manifest = computeTrinketManifest(["meteorite", "tattered-pages"]);
    expect(manifest).toEqual({ ...defaultTrinketEffects, firstBurnDoubled: true, extraDrawPerBattle: 1 });
    manifest.firstBurnDoubled = false;
    manifest.extraDrawPerBattle = 99;
    expect(computeTrinketManifest(["meteorite", "tattered-pages"]).extraDrawPerBattle).toBe(1);
    expect(computeTrinketManifest([])).toEqual(defaultTrinketEffects);
    expect(defaultTrinketEffects.firstBurnDoubled).toBe(false);
  });

  it("ignores missing and inherited IDs while retaining valid effects", () => {
    expect(computeTrinketManifest([])).toEqual(defaultTrinketEffects);
    expect(computeTrinketManifest(["missing", "constructor", "__proto__"])).toEqual(defaultTrinketEffects);
    expect(
      computeTrinketManifest(["missing", "brass-censer", "toString", "tattered-pages", "sundering-charm"]),
    ).toEqual({
      ...defaultTrinketEffects,
      brassCenserProcChance: 20,
      extraDrawPerBattle: 1,
      sunderingArmorPiercing: 2,
    });
  });

  it("gives an equipped Trinket and its matching Boon one shared effect", () => {
    const ids = ["brass-censer"];
    const boon = computeTrinketManifest(combineTrinketEffectIds(ids, null));
    expect(computeTrinketManifest(combineTrinketEffectIds([], ids[0]!))).toEqual(boon);
    expect(combineTrinketEffectIds(ids, ids[0]!)).toEqual(ids);
    expect(computeTrinketManifest([ids[0]!, ids[0]!])).toEqual(boon);
    expect(combineTrinketEffectIds(ids, "meteorite")).toEqual(["brass-censer", "meteorite"]);
    expect(ids).toEqual(["brass-censer"]);
  });

  it("reads a single field without building the manifest", () => {
    const ids = ["missing", "brass-censer", "constructor"];
    expect(getTrinketEffectValue(ids, "brassCenserProcChance")).toBe(computeTrinketManifest(ids).brassCenserProcChance);
    expect(getTrinketEffectValue(ids, "brassCenserProcChance")).toBe(20);
    expect(getTrinketEffectValue([], "merchantsFavorDiscount")).toBe(0);
    expect(getTrinketEffectValue(["merchants-favor"], "merchantsFavorDiscount")).toBe(7);
  });
});
