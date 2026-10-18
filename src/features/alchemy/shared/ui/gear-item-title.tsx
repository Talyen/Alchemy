import { useGameTranslation } from "@/components/use-game-translation";

import {
  getGearDefinitionTextShineColors,
  getGearInstanceTextShineColors,
  getGearInstanceTitle,
  type GearDefinition,
  type GearInstance,
} from "@/lib/gear";
import type { TrinketEntry } from "@/lib/game-data";
import { getTrinketTextShineColors } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";

import { ShineText } from "./shine-text";

interface GearProps {
  instance?: GearInstance | undefined;
  definition?: GearDefinition | undefined;
  className?: string | undefined;
}

export function GearItemTitle({ instance, definition, className }: GearProps) {
  const i18n = useGameTranslation();
  const title = instance ? getGearInstanceTitle(instance) : definition ? definition.displayName : "Gear";
  const colors = instance
    ? getGearInstanceTextShineColors(instance)
    : definition
      ? getGearDefinitionTextShineColors(definition)
      : [];

  return (
    <ShineText colors={colors} className={cn("whitespace-nowrap", className)}>
      {i18n.displayText(title)}
    </ShineText>
  );
}

interface TrinketProps {
  trinket: Pick<TrinketEntry, "id" | "title">;
  className?: string | undefined;
}

export function TrinketItemTitle({ trinket, className }: TrinketProps) {
  const i18n = useGameTranslation();
  return (
    <ShineText colors={getTrinketTextShineColors(trinket.id)} className={className}>
      {i18n.displayText(trinket.title)}
    </ShineText>
  );
}
