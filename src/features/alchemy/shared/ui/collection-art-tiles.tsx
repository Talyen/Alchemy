import type { ReactNode } from "react";

import type { TrinketEntry } from "@/lib/game-data";
import { gearDefinitions, getAstralShineColors, getGearInstanceTitle, type GearInstance } from "@/lib/gear";
import { cn } from "@/lib/utils";

import {
  cardSurfaceClass,
  gearArtAspectClass,
  gearArtFillClass,
  getTileWidthClass,
  getTrinketShineColors,
  getPlasmaColorPairForTrinket,
  trinketArtFillClass,
  trinketArtImageClass,
  trinketArtTileClass,
} from "../config";
import { DetailPopup } from "./card-popup";
import { GearDetailPopup } from "./gear-detail-popup";
import { InteractiveArtTile } from "./interactive-art-tile";
import { TrinketItemTitle } from "./gear-item-title";

export interface TrinketTileProps {
  trinket: TrinketEntry;
  interactionKey: string;

  idPrefix?: string | undefined;
  as?: "button" | "div" | undefined;
  selected?: boolean | undefined;
  disabled?: boolean | undefined;
  interactiveChrome?: boolean | undefined;
  onClick?: (() => void) | undefined;
  ariaLabel?: string | undefined;

  footerChip?: string | null | undefined;

  className?: string | undefined;

  shine?: boolean | undefined;
  temporary?: boolean | undefined;
  children?: ReactNode | undefined;

  onHoverChange?: ((hovered: boolean) => void) | undefined;
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
  onHoverChange,
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
      onHoverChange={onHoverChange}
      popup={({ visible, triggerRef }) => (
        <DetailPopup
          idPrefix={idPrefix}
          title={<TrinketItemTitle trinket={trinket} />}
          footerChip={footerChip === null ? undefined : (footerChip ?? (temporary ? "Boon" : undefined))}
          descriptionLines={trinket.descriptionLines}
          visible={visible}
          triggerRef={triggerRef}
          plasmaColorPair={getPlasmaColorPairForTrinket(trinket)}
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

  shine?: boolean | undefined;
  onClick?: (() => void) | undefined;
  ariaLabel?: string | undefined;
  children?: ReactNode | undefined;

  onHoverChange?: ((hovered: boolean) => void) | undefined;
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
  onHoverChange,
}: GearTileProps) {
  const definition = gearDefinitions[instance.definitionId];
  const title = getGearInstanceTitle(instance);
  return (
    <InteractiveArtTile
      id={instance.instanceId}
      interactionKey={interactionKey}
      title={title}
      art={definition?.art ?? ""}
      className={cn(cardSurfaceClass, getTileWidthClass("collection"), gearArtAspectClass)}
      imageClassName={gearArtFillClass}
      shineColor={shine ? getAstralShineColors(instance) : undefined}
      as={as}
      selected={selected}
      disabled={disabled}
      interactiveChrome={interactiveChrome}
      onClick={onClick}
      ariaLabel={ariaLabel}
      onHoverChange={onHoverChange}
      popup={({ visible, triggerRef }) => (
        <GearDetailPopup definition={definition} instance={instance} visible={visible} triggerRef={triggerRef} />
      )}
    >
      {children}
    </InteractiveArtTile>
  );
}
