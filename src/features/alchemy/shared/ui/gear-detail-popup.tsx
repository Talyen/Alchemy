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
}: {
  definition: GearDefinition | undefined;
  instance: GearInstance;
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
}) {
  if (!definition) return null;
  return (
    <PortaledTooltip
      triggerRef={triggerRef}
      visible={visible}
      className="rounded-shell-tooltip"
      plasmaColorPair={getPlasmaColorPairForGear(instance)}
    >
      <GearTooltipContent definition={definition} instance={instance} />
    </PortaledTooltip>
  );
}
