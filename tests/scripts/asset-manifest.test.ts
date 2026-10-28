import { fileURLToPath } from "node:url";
import { readArtManifest } from "../../scripts/assets/sync-generated-helpers.mjs";
import { describe, expect, it } from "vitest";
import { staticAssets, validateAssetRegistry } from "../../scripts/assets/asset-manifest.mjs";
import { ART_PRESETS } from "../../scripts/assets/asset-constants.mjs";
import { assetGroup } from "../../scripts/assets/asset-group.mjs";
import { artGroup } from "../../scripts/assets/art-group.mjs";
import { gearAssets } from "../../scripts/assets/gear-assets.mjs";

describe("asset manifest", () => {
  it("accepts prepared output manifests without weakening authoring source validation", async () => {
    const manifestPath = fileURLToPath(new URL("../../src/assets/optimized/.asset-hashes.json", import.meta.url));
    const manifest = await readArtManifest(manifestPath);
    expect(Object.keys(manifest)).toContain("card-back.webp");
    await expect(validateAssetRegistry([{ target: "card-back.webp" }])).rejects.toThrow(
      "Asset source must be a non-empty string",
    );
    await expect(validateAssetRegistry([{ target: "../escape.webp" }], { allowMissingSource: true })).rejects.toThrow(
      "Invalid target",
    );
  });

  it("preserves selected source paths, output identities and per-image transform overrides", async () => {
    const art = artGroup({ folder: "Actions", preset: ART_PRESETS.card, requiresTransparency: true }, [
      ["Haste.png", "haste.webp", ART_PRESETS.cardHaste],
      ["nested/Block.png", "block.webp"],
    ]);
    expect(art).toEqual([
      {
        source: "2d Assets/Game Sources/Actions/Haste.png",
        target: "haste.webp",
        ...ART_PRESETS.cardHaste,
        requiresTransparency: true,
      },
      {
        source: "2d Assets/Game Sources/Actions/nested/Block.png",
        target: "block.webp",
        ...ART_PRESETS.card,
        requiresTransparency: true,
      },
    ]);
    expect(
      assetGroup({ folder: "Sounds/", settings: {}, targetExtension: ".ogg" }, [
        "nested/impact.wav",
        ["hit.wav", "strike.ogg"],
      ]),
    ).toEqual([
      { source: "Sounds/nested/impact.wav", target: "impact.ogg" },
      { source: "Sounds/hit.wav", target: "strike.ogg" },
    ]);
    // Expansion must leave explicit output paths intact so the registry can reject escapes.
    await expect(
      validateAssetRegistry(
        artGroup({ folder: "Actions", preset: ART_PRESETS.card }, [["Block.png", "../escape.webp"]]),
      ),
    ).rejects.toThrow("Invalid target");
  });

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
    const entries = [...staticAssets, ...gearAssets];
    await expect(validateAssetRegistry(entries)).resolves.toEqual(entries);
  });

  it("keeps resource and card-pile transparency requirements with their transform presets", () => {
    const resources = ["wood", "iron", "herbs", "food", "gems", "gold", "stone", "hide"].map(
      (name) => `resource-${name}.webp`,
    );
    const piles = ["draw-pile.webp", "discard-pile.webp", "card-back.webp"];
    const families = [
      { targets: resources, preset: ART_PRESETS.resource },
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
