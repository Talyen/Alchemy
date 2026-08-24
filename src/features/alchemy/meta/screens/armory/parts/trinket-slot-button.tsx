import { memo } from "react";
import type { TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import {
  cardInteractiveGlowClass,
  cardSurfaceClass,
  collectionGridTileWidthClass,
  gearArtAspectClass,
  trinketArtFillClass,
  trinketArtImageClass,
} from "@/features/alchemy/shared/config";
import { DetailPopup } from "@/features/alchemy/shared/ui/card-popup";
import { TiltSurface } from "@/features/alchemy/shared/ui/tilt-surface";
import { useInteractiveCard } from "@/features/alchemy/shared/ui/use-interactive-card";
import { useTileHoverPopup } from "@/features/alchemy/shared/ui/use-tile-hover-popup";
import { GearSlotArt } from "./gear-slot-art";
import { SLOT_ARIA_LABELS } from "./slot-labels";

export const TrinketSlotButton = memo(function TrinketSlotButton({
  trinket,
  selected,
  editable,
  onSelect,
  onUnequip,
}: {
  trinket: TrinketEntry | undefined;
  selected: boolean;
  editable: boolean;
  onSelect: () => void;
  onUnequip: () => void;
}) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("armory", "trinket");
  const { wrapperRef, showPopup, handleHoverStart, handleMouseLeave, handleBlur } = useTileHoverPopup({
    interactive: true,
    isHovered,
    onHoverStart,
    onHoverEnd,
  });

  return (
    <div
      ref={wrapperRef}
      data-testid="armory-equipment-slot"
      data-slot="trinket"
      className="relative"
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleMouseLeave}
    >
      {trinket && showPopup ? (
        <DetailPopup
          idPrefix={`armory-slot-${trinket.id}`}
          title={trinket.title}
          footerChip="Armory"
          descriptionLines={trinket.descriptionLines}
          visible={isHovered}
          triggerRef={wrapperRef}
        />
      ) : null}
      <TiltSurface
        as="button"
        ariaLabel={SLOT_ARIA_LABELS.trinket}
        ariaPressed={selected}
        selected={selected}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        onFocus={handleHoverStart}
        onBlur={handleBlur}
        className={cn(
          cardSurfaceClass,
          collectionGridTileWidthClass,
          gearArtAspectClass,
          "group border border-border/80 shadow-md",
          cardInteractiveGlowClass,
          editable ? "cursor-pointer" : "cursor-default",
        )}
        onClick={() => {
          if (editable && selected && trinket) onUnequip();
          else onSelect();
        }}
      >
        <GearSlotArt definition={undefined} slot="trinket" />
        {trinket?.art ? (
          <img
            src={trinket.art}
            alt=""
            className={cn(trinketArtFillClass, trinketArtImageClass, "pointer-events-none absolute inset-0 z-10")}
          />
        ) : null}
      </TiltSurface>
    </div>
  );
});
