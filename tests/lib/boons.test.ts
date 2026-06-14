import { describe, expect, it } from "vitest";
import { boonLibrary } from "@/lib/game-data";
import { computeBoonManifest, defaultBoonEffects, isDefaultBoonManifest } from "@/lib/boons";

describe("computeBoonManifest", () => {
  it("returns all defaults for empty array", () => {
    const manifest = computeBoonManifest([]);
    expect(manifest).toEqual(defaultBoonEffects);
    expect(isDefaultBoonManifest(manifest)).toBe(true);
  });

  it("ignores unknown IDs gracefully", () => {
    const manifest = computeBoonManifest(["nonexistent-boon"]);
    expect(manifest).toEqual(defaultBoonEffects);
  });

  it("Brass Censer → firstHolyDamageDoubled: true", () => {
    const manifest = computeBoonManifest(["brass-censer"]);
    expect(manifest.firstHolyDamageDoubled).toBe(true);
  });

  it("Tattered Pages → extraDrawPerBattle: 1", () => {
    const manifest = computeBoonManifest(["tattered-pages"]);
    expect(manifest.extraDrawPerBattle).toBe(1);
  });

  it("Meteorite → firstBurnDoubled: true", () => {
    const manifest = computeBoonManifest(["meteorite"]);
    expect(manifest.firstBurnDoubled).toBe(true);
  });

  it("Bone Charm → boneCharmHealOnKill: 3", () => {
    const manifest = computeBoonManifest(["bone-charm"]);
    expect(manifest.boneCharmHealOnKill).toBe(3);
  });

  it("Obsidian Hammer → forgeStunThreshold: 4, forgeStunAmount: 1", () => {
    const manifest = computeBoonManifest(["obsidian-hammer"]);
    expect(manifest.forgeStunThreshold).toBe(4);
    expect(manifest.forgeStunAmount).toBe(1);
  });

  it("Icy Heart → frozenHeartDamage: 6", () => {
    const manifest = computeBoonManifest(["icy-heart"]);
    expect(manifest.frozenHeartDamage).toBe(6);
  });

  it("Ironwood Buckler → blockToArmorThreshold: 6, blockToArmorAmount: 1", () => {
    const manifest = computeBoonManifest(["ironwood-buckler"]);
    expect(manifest.blockToArmorThreshold).toBe(6);
    expect(manifest.blockToArmorAmount).toBe(1);
  });

  it("Runic Quill → runicQuillDrawOnConsume: 1", () => {
    const manifest = computeBoonManifest(["runic-quill"]);
    expect(manifest.runicQuillDrawOnConsume).toBe(1);
  });

  it("Sin-Eater's Lantern → sinEaterHealOnHarmfulStatusRemove: 6", () => {
    const manifest = computeBoonManifest(["sin-eaters-lantern"]);
    expect(manifest.sinEaterHealOnHarmfulStatusRemove).toBe(6);
  });

  it("Vanguard's Crest → vanguardCrestForgeOnBlockAbsorb: 1", () => {
    const manifest = computeBoonManifest(["vanguards-crest"]);
    expect(manifest.vanguardCrestForgeOnBlockAbsorb).toBe(1);
  });

  it("Parasitic Bloom → parasiticBloomLeechChance: 10", () => {
    const manifest = computeBoonManifest(["parasitic-bloom"]);
    expect(manifest.parasiticBloomLeechChance).toBe(10);
  });

  it("Cutpurse Knife → cutpurseGoldOnBleed: 1", () => {
    const manifest = computeBoonManifest(["cutpurse-knife"]);
    expect(manifest.cutpurseGoldOnBleed).toBe(1);
  });

  it("Wishing Well Coin → wishingWellGoldOnWish: 3", () => {
    const manifest = computeBoonManifest(["wishing-well-coin"]);
    expect(manifest.wishingWellGoldOnWish).toBe(3);
  });

  it("Merchant's Favor → merchantsFavorDiscount: 7 (first purchase discount in shop)", () => {
    const manifest = computeBoonManifest(["merchants-favor"]);
    expect(manifest.merchantsFavorDiscount).toBe(7);
  });

  it("Plague Doctor's Mask → plagueDoctorImmunity: true", () => {
    const manifest = computeBoonManifest(["plague-doctors-mask"]);
    expect(manifest.plagueDoctorImmunity).toBe(true);
  });

  it("Mortar and Pestle → mortarPestleFreeFirstPotion: true", () => {
    const manifest = computeBoonManifest(["mortar-and-pestle"]);
    expect(manifest.mortarPestleFreeFirstPotion).toBe(true);
  });

  it("Sundering Charm → sunderingArmorPiercing: 2", () => {
    const manifest = computeBoonManifest(["sundering-charm"]);
    expect(manifest.sunderingArmorPiercing).toBe(2);
  });

  it("Resonant Chimes → resonantChimeCardsRequired: 3, resonantChimeMana: 1", () => {
    const manifest = computeBoonManifest(["resonant-chimes"]);
    expect(manifest.resonantChimeCardsRequired).toBe(3);
    expect(manifest.resonantChimeMana).toBe(1);
  });

  it("combines multiple boons", () => {
    const manifest = computeBoonManifest(["brass-censer", "tattered-pages", "sundering-charm"]);
    expect(manifest.firstHolyDamageDoubled).toBe(true);
    expect(manifest.extraDrawPerBattle).toBe(1);
    expect(manifest.sunderingArmorPiercing).toBe(2);
  });

  it("handles duplicate boon IDs (no double-counting)", () => {
    const manifest = computeBoonManifest(["brass-censer", "brass-censer"]);
    expect(manifest.firstHolyDamageDoubled).toBe(true);
  });

  it("Companion's Collar → companionDamageBonus: 1", () => {
    const manifest = computeBoonManifest(["companions-collar"]);
    expect(manifest.companionDamageBonus).toBe(1);
  });

  it("Polar Pendant → freezeDurationExtension: 1", () => {
    const manifest = computeBoonManifest(["frozen-pocketwatch"]);
    expect(manifest.freezeDurationExtension).toBe(1);
  });

  it("Thunderstone → thunderstoneDamageOnStun: 6", () => {
    const manifest = computeBoonManifest(["thunderstone"]);
    expect(manifest.thunderstoneDamageOnStun).toBe(6);
  });

  it("Lucky Clover → luckyCloverGoldChance: 10", () => {
    const manifest = computeBoonManifest(["lucky-clover"]);
    expect(manifest.luckyCloverGoldChance).toBe(10);
  });

  it("Smuggler's Map → smugglersMapGoldBonus: 2", () => {
    const manifest = computeBoonManifest(["smugglers-map"]);
    expect(manifest.smugglersMapGoldBonus).toBe(2);
  });

  it("Grove's Favor → grovesFavorStartHeal: 2", () => {
    const manifest = computeBoonManifest(["groves-favor"]);
    expect(manifest.grovesFavorStartHeal).toBe(2);
  });

  it("every boonLibrary id changes the manifest from defaults", () => {
    for (const { id } of boonLibrary) {
      expect(computeBoonManifest([id])).not.toEqual(defaultBoonEffects);
    }
  });
});
