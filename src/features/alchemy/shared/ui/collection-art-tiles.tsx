import { useGameTranslation } from "@/components/use-game-translation";

import type { TrinketEntry } from "@/lib/game-data";
import {
  gearDefinitions,
  getAstralShineColors,
  getGearInstanceTitle,
  getGearInstanceKeywordIds,
  type GearInstance,
} from "@/lib/gear";
import { extractKeywordIds } from "@/lib/keyword-text";
import { cn } from "@/lib/utils";

import {
  cardSurfaceClass,
  gearArtAspectClass,
  gearArtFillClass,
  getTileWidthClass,
  getTrinketShineColors,
  getInspectionKeywordShineColors,
  getPlasmaColorPairForTrinket,
  trinketArtFillClass,
  trinketArtImageClass,
  trinketArtTileClass,
} from "../config";
import { DetailPopup } from "./tooltips/card-popup";
import { GearDetailPopup } from "./tooltips/gear-detail-popup";
import { InteractiveArtTile, type InteractiveArtTileProps } from "./interactive-art-tile";
import { TrinketItemTitle } from "./gear-item-title";

type ItemTileProps = Pick<
  InteractiveArtTileProps,
  | "interactionKey"
  | "as"
  | "selected"
  | "disabled"
  | "ariaDisabled"
  | "interactiveChrome"
  | "onClick"
  | "ariaLabel"
  | "children"
  | "onHoverChange"
> & { className?: string | undefined; shine?: boolean | undefined };

export interface TrinketTileProps extends ItemTileProps {
  trinket: TrinketEntry;
  idPrefix?: string | undefined;
  chip?: string | null | undefined;
  imageClassName?: string | undefined;
  temporary?: boolean | undefined;
}

export function TrinketTile({
  trinket,
  idPrefix = trinket.id,
  chip,
  className,
  imageClassName,
  shine = true,
  temporary = false,
  ...tileProps
}: TrinketTileProps) {
  const i18n = useGameTranslation();
  const resolvedChip = chip ?? (temporary ? i18n.displayText("Boon") : undefined);
  return (
    <InteractiveArtTile
      {...tileProps}
      id={trinket.id}
      title={i18n.displayText(trinket.title)}
      art={trinket.art}
      className={cn(trinketArtTileClass, className)}
      imageClassName={cn(trinketArtFillClass, trinketArtImageClass, imageClassName)}
      shineOnHover
      shineColor={shine ? getTrinketShineColors(trinket.id) : undefined}
      popup={({ visible, triggerRef }) => (
        <DetailPopup
          idPrefix={idPrefix}
          title={i18n.displayText(<TrinketItemTitle trinket={trinket} />)}
          chip={resolvedChip === null ? undefined : resolvedChip}
          descriptionLines={trinket.descriptionLines}
          visible={visible}
          triggerRef={triggerRef}
          plasmaColorPair={getPlasmaColorPairForTrinket(trinket)}
        />
      )}
    />
  );
}

export interface GearTileProps extends ItemTileProps {
  instance: GearInstance;
  hoverKeywordShine?: boolean | undefined;
}

export function GearTile({
  instance,
  className,
  shine = true,
  hoverKeywordShine = false,
  ...tileProps
}: GearTileProps) {
  const i18n = useGameTranslation();
  const definition = gearDefinitions[instance.definitionId];
  const title = getGearInstanceTitle(instance);
  return (
    <InteractiveArtTile
      {...tileProps}
      id={instance.instanceId}
      title={i18n.displayText(title)}
      art={definition?.art ?? ""}
      className={cn(cardSurfaceClass, getTileWidthClass("collection"), gearArtAspectClass, className)}
      imageClassName={gearArtFillClass}
      shineOnHover
      shineColor={
        shine
          ? hoverKeywordShine
            ? getInspectionKeywordShineColors([
                ...getGearInstanceKeywordIds(instance),
                ...extractKeywordIds(definition?.descriptionLines.join(" ") ?? ""),
              ])
            : getAstralShineColors(instance)
          : undefined
      }
      popup={({ visible, triggerRef }) => (
        <GearDetailPopup definition={definition} instance={instance} visible={visible} triggerRef={triggerRef} />
      )}
    />
  );
}
