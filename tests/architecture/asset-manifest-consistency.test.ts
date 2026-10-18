import { describe, expect, it } from "vitest";
import { allGameArt, essentialGameArt } from "@/lib/game-data";
import { gearArtByDefinitionId, getCatalogArt } from "@/lib/game-data";
import { readFileSync } from "node:fs";
import { GEAR_SLOT_IDS } from "../../scripts/assets/gear-filenames.mjs";

describe("asset manifest consistency", () => {
  it("registers exactly the prepared images", () => {
    const prepared = JSON.parse(readFileSync("src/assets/optimized/.asset-hashes.json", "utf8")) as Record<
      string,
      unknown
    >;
    const filenames = allGameArt.map((url) => url.slice(url.lastIndexOf("/") + 1));
    expect(filenames.toSorted()).toEqual(Object.keys(prepared).toSorted());
    expect(new Set(allGameArt).size).toBe(allGameArt.length);
    for (const filename of filenames.filter((file) => !/^gear-/.test(file))) {
      expect(getCatalogArt(filename.slice(0, -".webp".length))).toBe(
        allGameArt.find((url) => url.endsWith(`/${filename}`)),
      );
    }
    expect(() => getCatalogArt("missing-art")).toThrow("Missing catalog artwork: missing-art");
    expect(() => getCatalogArt("__proto__")).toThrow("Missing catalog artwork: __proto__");
  });

  it("keeps essentialGameArt as allGameArt minus deferred gear", () => {
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

  it("keeps pipeline slot ids and runtime slot art in agreement", () => {
    for (const slotId of GEAR_SLOT_IDS) {
      expect(
        gearArtByDefinitionId[`slot-${slotId}`],
        `missing runtime art for pipeline slot "${slotId}" (add the slot background or update GEAR_SLOT_IDS)`,
      ).toBeTruthy();
    }
  });
});
