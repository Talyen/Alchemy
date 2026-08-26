// Shared trinket/gear art-tile presets so reward, shop, inspect, and summary
// screens render identical art chrome and detail popups from one definition.
import type { ReactNode } from "react";

import type { TrinketEntry } from "@/lib/game-data";
import { gearDefinitions, getAstralShineColors, getGearInstanceTitle, type GearInstance } from "@/lib/gear";
import { cn } from "@/lib/utils";

import {
  cardSurfaceClass,
  collectionTileWidthClass,
  gearArtAspectClass,
  gearArtFillClass,
  getTrinketShineColors,
  trinketArtFillClass,
  trinketArtImageClass,
  trinketArtTileClass,
} from "../config";
import { DetailPopup } from "./card-popup";
import { GearDetailPopup } from "./gear-detail-popup";
import { InteractiveArtTile } from "./interactive-art-tile";
import { TrinketItemTitle } from "./trinket-item-title";

export interface TrinketTileProps {
  trinket: TrinketEntry;
  interactionKey: string;
  /** Popup id namespace; defaults to the trinket id. */
  idPrefix?: string | undefined;
  as?: "button" | "div" | undefined;
  selected?: boolean | undefined;
  disabled?: boolean | undefined;
  interactiveChrome?: boolean | undefined;
  onClick?: (() => void) | undefined;
  ariaLabel?: string | undefined;
  /** Popup footer label; pass null to omit. Defaults to "Boon" for temporary trinkets. */
  footerChip?: string | null | undefined;
  /** Merged after the default tile classes; Armory inventory uses this to shrink to the grid cell. */
  className?: string | undefined;
  /** Keyword shine; pass false for sold-out/purchased states. */
  shine?: boolean | undefined;
  temporary?: boolean | undefined;
  children?: ReactNode | undefined;
}

export function TrinketTile({
  trinket,
  interactionKey,
  idPrefix = trinket.id,
  as,
  selected,
  disabled,
  interactiveChrome,
  onClick,
  ariaLabel,
  footerChip,
  className,
  shine = true,
  temporary = false,
  children,
}: TrinketTileProps) {
  return (
    <InteractiveArtTile
      id={trinket.id}
      interactionKey={interactionKey}
      title={trinket.title}
      art={trinket.art}
      className={cn(trinketArtTileClass, className)}
      imageClassName={cn(trinketArtFillClass, trinketArtImageClass)}
      shineColor={shine ? getTrinketShineColors(trinket.id) : undefined}
      as={as}
      selected={selected}
      disabled={disabled}
      interactiveChrome={interactiveChrome}
      onClick={onClick}
      ariaLabel={ariaLabel}
      popup={({ visible, triggerRef }) => (
        <DetailPopup
          idPrefix={idPrefix}
          title={<TrinketItemTitle trinket={trinket} />}
          footerChip={footerChip === null ? undefined : (footerChip ?? (temporary ? "Boon" : undefined))}
          descriptionLines={trinket.descriptionLines}
          visible={visible}
          triggerRef={triggerRef}
        />
      )}
    >
      {children}
    </InteractiveArtTile>
  );
}

export interface GearTileProps {
  instance: GearInstance;
  interactionKey: string;
  as?: "button" | "div" | undefined;
  selected?: boolean | undefined;
  disabled?: boolean | undefined;
  interactiveChrome?: boolean | undefined;
  /** Astral/unique shine derived from rarity; pass false for sold-out/purchased states. */
  shine?: boolean | undefined;
  onClick?: (() => void) | undefined;
  ariaLabel?: string | undefined;
  children?: ReactNode | undefined;
}

export function GearTile({
  instance,
  interactionKey,
  as,
  selected,
  disabled,
  interactiveChrome,
  shine = true,
  onClick,
  ariaLabel,
  children,
}: GearTileProps) {
  const definition = gearDefinitions[instance.definitionId];
  const title = getGearInstanceTitle(instance);
  return (
    <InteractiveArtTile
      id={instance.instanceId}
      interactionKey={interactionKey}
      title={title}
      art={definition?.art ?? ""}
      className={cn(cardSurfaceClass, collectionTileWidthClass, gearArtAspectClass)}
      imageClassName={gearArtFillClass}
      shineColor={shine ? getAstralShineColors(instance) : undefined}
      as={as}
      selected={selected}
      disabled={disabled}
      interactiveChrome={interactiveChrome}
      onClick={onClick}
      ariaLabel={ariaLabel}
      // Same rich content everywhere so gear exposes rarity and rolled affixes,
      // not just base description lines.
      popup={({ visible, triggerRef }) => (
        <GearDetailPopup definition={definition} instance={instance} visible={visible} triggerRef={triggerRef} />
      )}
    >
      {children}
    </InteractiveArtTile>
  );
}
