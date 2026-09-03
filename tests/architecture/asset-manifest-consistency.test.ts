import { describe, expect, it } from "vitest";
import { allGameArt, essentialGameArt } from "@/lib/game-data";
import { gearArtByDefinitionId } from "@/lib/game-data/gear-art";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- scripts are JS without declarations
// @ts-ignore scripts are untyped JS helpers
import { QUALITY, WIDTH } from "../../scripts/lib/asset-constants.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- scripts are JS without declarations
// @ts-ignore scripts are untyped JS helpers
import { staticAssets } from "../../scripts/assets/asset-manifest.mjs";

describe("asset manifest consistency", () => {
  it("uses only frozen WIDTH/QUALITY presets (no magic literals)", () => {
    const allowedWidths = new Set(Object.values(WIDTH));
    const allowedQualities = new Set(Object.values(QUALITY));
    for (const entry of staticAssets) {
      expect(allowedWidths.has(entry.width), `${entry.target} width ${entry.width} must be from WIDTH`).toBe(true);
      expect(allowedQualities.has(entry.quality), `${entry.target} quality ${entry.quality} must be from QUALITY`).toBe(
        true,
      );
    }
  });

  it("keeps essentialGameArt as allGameArt minus non-slot gear assets", () => {
    const gearItemSet = new Set(
      Object.entries(gearArtByDefinitionId)
        .filter(([id]) => !id.startsWith("slot-"))
        .map(([, src]) => src),
    );
    const slotSet = new Set(
      Object.entries(gearArtByDefinitionId)
        .filter(([id]) => id.startsWith("slot-"))
        .map(([, src]) => src),
    );
    for (const src of essentialGameArt) {
      expect(gearItemSet.has(src), `${src} should not be in essentialGameArt`).toBe(false);
    }
    for (const src of slotSet) {
      expect(essentialGameArt, `${src} slot background should load with startup art`).toContain(src);
    }
    expect(essentialGameArt.length).toBeLessThan(allGameArt.length);
    expect(essentialGameArt.length + gearItemSet.size).toBe(allGameArt.length);
  });

  it("has no duplicate targets", () => {
    const targets = staticAssets.map((e) => e.target);
    expect(new Set(targets).size).toBe(targets.length);
  });
});
