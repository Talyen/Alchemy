import type { ArmorySlot } from "@/lib/gear";

interface TransferRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface FlyingItem {
  id: string;
  art: string;
  sourceRect: TransferRect;
  destRect?: TransferRect | null | undefined;
  isFadingOut?: boolean | undefined;
  isTrinket?: boolean | undefined;
}

type Rect = FlyingItem["sourceRect"];
export interface TransferArtwork {
  id: string;
  art: string | undefined;
  isTrinket?: boolean;
}

export interface ArmoryFlight extends FlyingItem {
  hidden: { inventoryId: string } | { slot: ArmorySlot };
}

interface EquipPresentation {
  incoming: TransferArtwork;
  replaced?: TransferArtwork | undefined;
  slot: ArmorySlot;
  sourceRect: Rect | undefined;
  slotRect: Rect | undefined;
  displaced: Array<{ artwork: TransferArtwork; slot: ArmorySlot; rect: Rect | undefined }>;
  panelRect: Rect | undefined;
}

export function buildEquipFlights(input: EquipPresentation): ArmoryFlight[] {
  const { incoming, replaced, slot, sourceRect, slotRect, displaced, panelRect } = input;
  if (!sourceRect || !slotRect || !incoming.art) return [];
  const flights: ArmoryFlight[] = [
    {
      id: `equip-${incoming.id}`,
      art: incoming.art,
      isTrinket: incoming.isTrinket,
      sourceRect,
      destRect: slotRect,
      hidden: { slot },
    },
  ];
  if (replaced?.art) {
    flights.push({
      id: `replace-${replaced.id}`,
      art: replaced.art,
      isTrinket: replaced.isTrinket,
      sourceRect: slotRect,
      destRect: sourceRect,
      hidden: { inventoryId: replaced.id },
    });
  }
  for (const item of displaced) {
    if (!item.rect || !item.artwork.art) continue;
    flights.push({
      id: `conflict-${item.artwork.id}`,
      art: item.artwork.art,
      sourceRect: item.rect,
      destRect: panelRect,
      isFadingOut: true,
      hidden: { slot: item.slot },
    });
  }
  return flights;
}

export function buildUnequipFlights(
  artwork: TransferArtwork,
  sourceRect: Rect | undefined,
  destRect: Rect | undefined,
): ArmoryFlight[] {
  if (!artwork.art || !sourceRect || !destRect) return [];
  return [
    {
      id: `unequip-${artwork.id}`,
      art: artwork.art,
      isTrinket: artwork.isTrinket,
      sourceRect,
      destRect,
      hidden: { inventoryId: artwork.id },
    },
  ];
}

export function hiddenTransferArtwork(flights: readonly ArmoryFlight[]) {
  const hiddenArtworkIds = new Set<string>();
  const hiddenArtworkSlots: Partial<Record<ArmorySlot, boolean>> = {};
  for (const { hidden } of flights) {
    if ("inventoryId" in hidden) hiddenArtworkIds.add(hidden.inventoryId);
    else hiddenArtworkSlots[hidden.slot] = true;
  }
  return { hiddenArtworkIds, hiddenArtworkSlots };
}
