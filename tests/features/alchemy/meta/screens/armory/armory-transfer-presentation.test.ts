import { describe, expect, it } from "vitest";
import {
  buildEquipFlights,
  buildUnequipFlights,
  hiddenTransferArtwork,
} from "@/features/alchemy/meta/screens/armory/armory-transfer-presentation";

const sourceRect = { top: 0, left: 100, width: 50, height: 60 };
const slotRect = { ...sourceRect, left: 0 };
const incoming = { id: "incoming", art: "incoming.png", isTrinket: true };
const replaced = { id: "replaced", art: "replaced.png", isTrinket: true };
const replacement = {
  incoming,
  replaced,
  slot: "trinket" as const,
  sourceRect,
  slotRect,
  displaced: [],
  panelRect: undefined,
};

describe("Armory transfer presentation", () => {
  it("returns replacement Trinkets to the clicked tile and masks only travelling artwork", () => {
    const flights = buildEquipFlights(replacement);
    expect(flights).toHaveLength(2);
    expect(flights[0]).toMatchObject({ sourceRect, destRect: slotRect, isTrinket: true });
    expect(flights[1]).toMatchObject({ sourceRect: slotRect, destRect: sourceRect, isTrinket: true });
    expect(hiddenTransferArtwork(flights)).toEqual({
      hiddenArtworkIds: new Set([replaced.id]),
      hiddenArtworkSlots: { trinket: true },
    });
  });

  it("does not hide a replacement whose artwork cannot fly", () => {
    const flights = buildEquipFlights({ ...replacement, replaced: { ...replaced, art: undefined } });
    expect(flights).toHaveLength(1);
    expect(hiddenTransferArtwork(flights).hiddenArtworkIds.size).toBe(0);
    expect(buildEquipFlights({ ...replacement, sourceRect: undefined })).toEqual([]);
    expect(buildEquipFlights({ ...replacement, incoming: { ...incoming, art: undefined } })).toEqual([]);
  });

  it("returns unequipped artwork to inventory only when both endpoints exist", () => {
    const flights = buildUnequipFlights(incoming, slotRect, sourceRect);
    expect(flights[0]).toMatchObject({ sourceRect: slotRect, destRect: sourceRect, isTrinket: true });
    expect(hiddenTransferArtwork(flights).hiddenArtworkIds).toEqual(new Set([incoming.id]));
    expect(buildUnequipFlights(incoming, slotRect, undefined)).toEqual([]);
  });
});
