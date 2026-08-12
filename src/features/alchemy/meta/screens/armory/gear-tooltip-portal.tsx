import type { RefObject } from "react";
import type { GearDefinition, GearInstance } from "@/lib/gear";
import { PortaledTooltip } from "../../../shared/ui/portaled-tooltip";
import { GearTooltipContent } from "../../../shared/ui/gear-tooltip-content";

interface Props {
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
  definition: GearDefinition;
  instance?: GearInstance;
}

export function GearTooltipPortal({ triggerRef, visible, definition, instance }: Props) {
  return (
    <PortaledTooltip triggerRef={triggerRef} visible={visible} className="armory-inventory-tooltip !shadow-none">
      <GearTooltipContent definition={definition} {...(instance ? { instance } : {})} />
    </PortaledTooltip>
  );
}
