import { describe, expect, it } from "vitest";
import { allGameArt, essentialGameArt, onDemandBoardArt } from "@/lib/game-data";
import { gearArtByDefinitionId } from "@/lib/game-data/gear-art.generated";
import { GEAR_SLOT_IDS } from "../../scripts/assets/gear-filenames.mjs";

describe("asset manifest consistency", () => {
  it("keeps essentialGameArt as allGameArt minus deferred gear and on-demand boards", () => {
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
      expect(onDemandBoardArt.has(src), `${src} should decode only when displayed`).toBe(false);
      expect(gearItemSet.has(src), `${src} should not be in essentialGameArt`).toBe(false);
    }
    for (const src of slotSet) {
      expect(essentialGameArt, `${src} slot background should load with startup art`).toContain(src);
    }
    expect(essentialGameArt.length).toBeLessThan(allGameArt.length);
    expect(essentialGameArt.length + gearItemSet.size + onDemandBoardArt.size).toBe(allGameArt.length);
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
