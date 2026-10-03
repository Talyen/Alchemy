import { describe, expect, it } from "vitest";
import { trinketLibrary } from "@/lib/game-data";
import {
  combineTrinketEffectIds,
  computeTrinketManifest,
  defaultTrinketEffects,
  isDefaultTrinketManifest,
} from "@/lib/trinkets";

describe("Trinket manifests", () => {
  it("applies every catalog payload without changing shared defaults", () => {
    const before = { ...defaultTrinketEffects };
    for (const entry of trinketLibrary) {
      const manifest = computeTrinketManifest([entry.id]);
      expect(manifest, entry.id).toEqual({ ...before, ...entry.effects });
      expect(isDefaultTrinketManifest(manifest), entry.id).toBe(false);
    }
    expect(defaultTrinketEffects).toEqual(before);
  });

  it("ignores missing and inherited IDs while retaining valid effects", () => {
    expect(computeTrinketManifest([])).toEqual(defaultTrinketEffects);
    expect(isDefaultTrinketManifest(computeTrinketManifest(["missing", "constructor", "__proto__"]))).toBe(true);
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
});
