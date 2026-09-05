import { type RefObject } from "react";
import { type GearDefinition, type GearInstance } from "@/lib/gear";

import { GearTooltipContent } from "./gear-tooltip-content";
import { PortaledTooltip } from "./portaled-tooltip";
import { getPlasmaColorPairForGear } from "../config";

export function GearDetailPopup({
  definition,
  instance,
  triggerRef,
  visible,
  padding,
}: {
  definition: GearDefinition | undefined;
  instance: GearInstance;
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
  padding?: number | undefined;
}) {
  if (!definition) return null;
  return (
    <PortaledTooltip
      triggerRef={triggerRef}
      visible={visible}
      className="rounded-shell-tooltip"
      plasmaColorPair={getPlasmaColorPairForGear(instance)}
      {...(padding !== undefined ? { padding } : {})}
    >
      <GearTooltipContent definition={definition} instance={instance} />
    </PortaledTooltip>
  );
}
