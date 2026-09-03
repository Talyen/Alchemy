import { cn } from "@/lib/utils";
import {
  cardInteractiveGlowClass,
  cardShineFrameClass,
  cardSurfaceClass,
  collectionGridTileWidthClass,
  gearArtAspectClass,
} from "../../../../shared/config";
import { useInteractiveCard } from "../../../../shared/ui/use-interactive-card";
import { useTileHoverPopup } from "../../../../shared/ui/use-tile-hover-popup";

export const ARMORY_GEAR_SLOT_TESTID = "armory-equipment-slot";
export const ARMORY_TRINKET_SLOT_TESTID = "armory-trinket-slot";

export function useArmorySlotHover(key: string) {
  const card = useInteractiveCard("armory", key);
  const popup = useTileHoverPopup({
    interactive: true,
    isHovered: card.isHovered,
    onHoverStart: card.onHoverStart,
    onHoverEnd: card.onHoverEnd,
  });
  return { ...card, ...popup };
}

export function armorySlotSurfaceClass(editable: boolean, showShine: boolean) {
  return cn(
    cardSurfaceClass,
    collectionGridTileWidthClass,
    gearArtAspectClass,
    "group shadow-md",
    showShine && cardShineFrameClass,
    !showShine && "border border-border/80",
    cardInteractiveGlowClass,
    editable ? "cursor-pointer" : "cursor-default",
  );
}
