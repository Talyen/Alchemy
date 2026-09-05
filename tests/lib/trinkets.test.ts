import { describe, expect, it } from "vitest";
import { trinketLibrary } from "@/lib/game-data";
import {
  combineTrinketEffectIds,
  computeTrinketManifest,
  defaultTrinketEffects,
  isDefaultTrinketManifest,
} from "@/lib/trinkets";

describe("computeTrinketManifest", () => {
  it("returns all defaults for empty array", () => {
    const manifest = computeTrinketManifest([]);
    expect(manifest).toEqual(defaultTrinketEffects);
    expect(isDefaultTrinketManifest(manifest)).toBe(true);
  });

  it("ignores unknown IDs gracefully", () => {
    const manifest = computeTrinketManifest(["nonexistent-boon"]);
    expect(manifest).toEqual(defaultTrinketEffects);
  });

  it("Brass Censer → brassCenserProcChance: 20", () => {
    const manifest = computeTrinketManifest(["brass-censer"]);
    expect(manifest.brassCenserProcChance).toBe(20);
  });

  it("Tattered Pages → extraDrawPerBattle: 1", () => {
    const manifest = computeTrinketManifest(["tattered-pages"]);
    expect(manifest.extraDrawPerBattle).toBe(1);
  });

  it("Meteorite → firstBurnDoubled: true", () => {
    const manifest = computeTrinketManifest(["meteorite"]);
    expect(manifest.firstBurnDoubled).toBe(true);
  });

  it("Bone Charm → boneCharmHealOnKill: 3", () => {
    const manifest = computeTrinketManifest(["bone-charm"]);
    expect(manifest.boneCharmHealOnKill).toBe(3);
  });

  it("Obsidian Hammer → forgeStunThreshold: 4, forgeStunAmount: 1", () => {
    const manifest = computeTrinketManifest(["obsidian-hammer"]);
    expect(manifest.forgeStunThreshold).toBe(4);
    expect(manifest.forgeStunAmount).toBe(1);
  });

  it("Icy Heart → frozenHeartDamage: 6", () => {
    const manifest = computeTrinketManifest(["icy-heart"]);
    expect(manifest.frozenHeartDamage).toBe(6);
  });

  it("Ironwood Buckler → blockToArmorThreshold: 6, blockToArmorAmount: 1", () => {
    const manifest = computeTrinketManifest(["ironwood-buckler"]);
    expect(manifest.blockToArmorThreshold).toBe(6);
    expect(manifest.blockToArmorAmount).toBe(1);
  });

  it("Runic Quill → runicQuillDrawOnConsume: 1", () => {
    const manifest = computeTrinketManifest(["runic-quill"]);
    expect(manifest.runicQuillDrawOnConsume).toBe(1);
  });

  it("Sin-Eater's Lantern → sinEaterHealOnHarmfulStatusRemove: 6", () => {
    const manifest = computeTrinketManifest(["sin-eaters-lantern"]);
    expect(manifest.sinEaterHealOnHarmfulStatusRemove).toBe(6);
  });

  it("Vanguard's Crest → vanguardCrestForgeOnBlockAbsorb: 1", () => {
    const manifest = computeTrinketManifest(["vanguards-crest"]);
    expect(manifest.vanguardCrestForgeOnBlockAbsorb).toBe(1);
  });

  it("Parasitic Bloom → parasiticBloomLeechChance: 10", () => {
    const manifest = computeTrinketManifest(["parasitic-bloom"]);
    expect(manifest.parasiticBloomLeechChance).toBe(10);
  });

  it("Cutpurse Knife → cutpurseGoldOnBleed: 1", () => {
    const manifest = computeTrinketManifest(["cutpurse-knife"]);
    expect(manifest.cutpurseGoldOnBleed).toBe(1);
  });

  it("Wishing Well Coin → wishingWellGoldOnWish: 3", () => {
    const manifest = computeTrinketManifest(["wishing-well-coin"]);
    expect(manifest.wishingWellGoldOnWish).toBe(3);
  });

  it("Merchant's Favor → merchantsFavorDiscount: 7 (first purchase discount in shop)", () => {
    const manifest = computeTrinketManifest(["merchants-favor"]);
    expect(manifest.merchantsFavorDiscount).toBe(7);
  });

  it("Plague Doctor's Mask → plagueDoctorPoisonCleanse: 2", () => {
    const manifest = computeTrinketManifest(["plague-doctors-mask"]);
    expect(manifest.plagueDoctorPoisonCleanse).toBe(2);
  });

  it("Mortar and Pestle → mortarPestleFreeFirstPotion: true", () => {
    const manifest = computeTrinketManifest(["mortar-and-pestle"]);
    expect(manifest.mortarPestleFreeFirstPotion).toBe(true);
  });

  it("Sundering Charm → sunderingArmorPiercing: 2", () => {
    const manifest = computeTrinketManifest(["sundering-charm"]);
    expect(manifest.sunderingArmorPiercing).toBe(2);
  });

  it("Resonant Chimes → resonantChimeCardsRequired: 3, resonantChimeMana: 1", () => {
    const manifest = computeTrinketManifest(["resonant-chimes"]);
    expect(manifest.resonantChimeCardsRequired).toBe(3);
    expect(manifest.resonantChimeMana).toBe(1);
  });

  it("combines multiple boons", () => {
    const manifest = computeTrinketManifest(["brass-censer", "tattered-pages", "sundering-charm"]);
    expect(manifest.brassCenserProcChance).toBe(20);
    expect(manifest.extraDrawPerBattle).toBe(1);
    expect(manifest.sunderingArmorPiercing).toBe(2);
  });

  it("handles duplicate boon IDs (no double-counting)", () => {
    const manifest = computeTrinketManifest(["brass-censer", "brass-censer"]);
    expect(manifest.brassCenserProcChance).toBe(20);
  });

  it("deduplicates an equipped trinket that matches an active boon", () => {
    expect(combineTrinketEffectIds(["bone-charm"], "bone-charm")).toEqual(["bone-charm"]);
    expect(combineTrinketEffectIds(["bone-charm"], "meteorite")).toEqual(["bone-charm", "meteorite"]);
  });

  it.each(["brass-censer", "plague-doctors-mask"])(
    "%s has identical Boon, Trinket, and matching-pair effects",
    (id) => {
      const boon = computeTrinketManifest(combineTrinketEffectIds([id], null));
      const trinket = computeTrinketManifest(combineTrinketEffectIds([], id));
      const both = computeTrinketManifest(combineTrinketEffectIds([id], id));
      expect(boon).not.toEqual(defaultTrinketEffects);
      expect(trinket).toEqual(boon);
      expect(both).toEqual(boon);
    },
  );

  it("Companion's Collar → companionDamageBonus: 1", () => {
    const manifest = computeTrinketManifest(["companions-collar"]);
    expect(manifest.companionDamageBonus).toBe(1);
  });

  it("Polar Pendant → freezeDurationExtension: 1", () => {
    const manifest = computeTrinketManifest(["frozen-pocketwatch"]);
    expect(manifest.freezeDurationExtension).toBe(1);
  });

  it("Thunderstone → thunderstoneDamageOnStun: 6", () => {
    const manifest = computeTrinketManifest(["thunderstone"]);
    expect(manifest.thunderstoneDamageOnStun).toBe(6);
  });

  it("Lucky Clover → luckyCloverGoldChance: 10", () => {
    const manifest = computeTrinketManifest(["lucky-clover"]);
    expect(manifest.luckyCloverGoldChance).toBe(10);
  });

  it("Smuggler's Map → smugglersMapGoldBonus: 2", () => {
    const manifest = computeTrinketManifest(["smugglers-map"]);
    expect(manifest.smugglersMapGoldBonus).toBe(2);
  });

  it("Grove's Favor → grovesFavorStartHeal: 2", () => {
    const manifest = computeTrinketManifest(["groves-favor"]);
    expect(manifest.grovesFavorStartHeal).toBe(2);
  });

  it("every trinketLibrary id changes the manifest from defaults", () => {
    for (const { id } of trinketLibrary) {
      expect(computeTrinketManifest([id])).not.toEqual(defaultTrinketEffects);
    }
  });
});
