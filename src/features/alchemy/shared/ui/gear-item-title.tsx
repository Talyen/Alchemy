import {
  getGearDefinitionTextShineColors,
  getGearDefinitionTitle,
  getGearInstanceTextShineColors,
  getGearInstanceTitle,
  type GearDefinition,
  type GearInstance,
} from "@/lib/gear";
import type { TrinketEntry } from "@/lib/game-data";
import { getTrinketShineColors } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";

import { ShineText } from "./shine-text";

interface GearProps {
  instance?: GearInstance | undefined;
  definition?: GearDefinition | undefined;
  className?: string | undefined;
}

export function GearItemTitle({ instance, definition, className }: GearProps) {
  const title = instance ? getGearInstanceTitle(instance) : definition ? getGearDefinitionTitle(definition) : "Gear";
  const colors = instance
    ? getGearInstanceTextShineColors(instance)
    : definition
      ? getGearDefinitionTextShineColors(definition)
      : [];

  return (
    <ShineText colors={colors} className={cn("whitespace-nowrap", className)}>
      {title}
    </ShineText>
  );
}

interface TrinketProps {
  trinket: Pick<TrinketEntry, "id" | "title">;
  className?: string | undefined;
}

export function TrinketItemTitle({ trinket, className }: TrinketProps) {
  return (
    <ShineText colors={getTrinketShineColors(trinket.id)} className={className}>
      {trinket.title}
    </ShineText>
  );
}
