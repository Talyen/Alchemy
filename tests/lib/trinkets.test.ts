import { describe, expect, it } from "vitest";
import { computeTrinketManifest, defaultTrinketEffects } from "@/lib/trinkets";

describe("computeTrinketManifest", () => {
  it("returns all defaults for empty array", () => {
    const manifest = computeTrinketManifest([]);
    expect(manifest).toEqual(defaultTrinketEffects);
  });

  it("ignores unknown IDs gracefully", () => {
    const manifest = computeTrinketManifest(["nonexistent-trinket"]);
    expect(manifest).toEqual(defaultTrinketEffects);
  });

  it("Brass Censer → firstHolyDamageDoubled: true", () => {
    const manifest = computeTrinketManifest(["brass-censer"]);
    expect(manifest.firstHolyDamageDoubled).toBe(true);
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

  it("Plague Doctor's Mask → plagueDoctorImmunity: true", () => {
    const manifest = computeTrinketManifest(["plague-doctors-mask"]);
    expect(manifest.plagueDoctorImmunity).toBe(true);
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

  it("combines multiple trinkets", () => {
    const manifest = computeTrinketManifest(["brass-censer", "tattered-pages", "sundering-charm"]);
    expect(manifest.firstHolyDamageDoubled).toBe(true);
    expect(manifest.extraDrawPerBattle).toBe(1);
    expect(manifest.sunderingArmorPiercing).toBe(2);
  });

  it("handles duplicate trinket IDs (no double-counting)", () => {
    const manifest = computeTrinketManifest(["brass-censer", "brass-censer"]);
    expect(manifest.firstHolyDamageDoubled).toBe(true);
  });

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
});
