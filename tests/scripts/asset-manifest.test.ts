import { describe, expect, it } from "vitest";
import { staticAssets, validateAssetRegistry } from "../../scripts/assets/asset-manifest.mjs";
import { ART_PRESETS } from "../../scripts/assets/asset-constants.mjs";

describe("asset manifest", () => {
  it.each(["123.webp", "fooBar.webp", "../escape.webp", "image.png"])(
    "rejects invalid export target %s",
    async (target) => {
      await expect(validateAssetRegistry([{ source: "fixture.png", target }])).rejects.toThrow("Invalid target");
    },
  );

  it("rejects filenames that collapse to the same export", async () => {
    await expect(
      validateAssetRegistry([
        { source: "first.png", target: "a-1.webp" },
        { source: "second.png", target: "a1.webp" },
      ]),
    ).rejects.toThrow('Duplicate asset export "a1"');
  });

  it("keeps registered sources, targets, and generated export names valid", async () => {
    await expect(validateAssetRegistry(staticAssets)).resolves.toEqual(staticAssets);
  });

  it("keeps resource and card-pile transparency requirements with their transform presets", () => {
    const resources = ["wood", "iron", "herbs", "food", "gems", "gold", "stone", "hide"].map(
      (name) => `resource-${name}.webp`,
    );
    const piles = ["draw-pile.webp", "discard-pile.webp", "card-back.webp"];
    const families = [
      { targets: [...resources, "battle-mana-crystal.webp"], preset: ART_PRESETS.resource },
      { targets: piles, preset: { ...ART_PRESETS.card, quality: ART_PRESETS.boon.quality } },
      { targets: ["mana-dock-full.webp", "mana-dock-empty.webp"], preset: ART_PRESETS.manaDockCrystal },
      { targets: ["mana-dock-frame.webp"], preset: ART_PRESETS.manaDock },
    ];
    for (const { targets, preset } of families) {
      for (const target of targets) {
        expect(staticAssets.find((entry) => entry.target === target)).toMatchObject({
          ...preset,
          requiresTransparency: true,
        });
      }
    }
  });
});
