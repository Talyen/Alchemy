import {
  getGearDefinitionShineGradient,
  getGearDefinitionTitle,
  getGearInstanceShineGradient,
  getGearInstanceTitle,
  type GearDefinition,
  type GearInstance,
} from "@/lib/gear";
import { cn } from "@/lib/utils";

import { ShineText } from "./shine-text";

interface Props {
  instance?: GearInstance | undefined;
  definition?: GearDefinition | undefined;
  className?: string | undefined;
}

export function GearItemTitle({ instance, definition, className }: Props) {
  const title = instance ? getGearInstanceTitle(instance) : definition ? getGearDefinitionTitle(definition) : "Gear";
  const gradient = instance
    ? getGearInstanceShineGradient(instance)
    : definition
      ? getGearDefinitionShineGradient(definition)
      : null;

  return (
    <ShineText gradient={gradient} className={cn("whitespace-nowrap", className)}>
      {title}
    </ShineText>
  );
}
