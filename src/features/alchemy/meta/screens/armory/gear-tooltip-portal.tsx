import { createPortal } from "react-dom";
import type { RefObject } from "react";
import type { GearDefinition, GearInstance } from "@/lib/gear";
import { TooltipPanel } from "../../../shared/ui/tooltip-panel";
import { GearTooltipContent } from "../../../shared/ui/gear-tooltip-content";
import { ARMORY_TOOLTIP_WIDTH } from "./gear-tooltip-content";
import { useArmoryPortaledTooltipPlacement } from "./armory-tooltip-placement";

interface Props {
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
  definition: GearDefinition;
  instance?: GearInstance;
}

export function GearTooltipPortal({ triggerRef, visible, definition, instance }: Props) {
  const { tooltipRef, placeBelow, tooltipStyle } = useArmoryPortaledTooltipPlacement(triggerRef, visible);

  if (!visible) return null;

  return createPortal(
    <TooltipPanel
      ref={tooltipRef}
      width={ARMORY_TOOLTIP_WIDTH}
      visible
      flip={placeBelow}
      className="armory-inventory-tooltip pointer-events-none fixed bottom-auto top-auto z-[100] mb-0 mt-0 !shadow-none"
      style={tooltipStyle}
    >
      <GearTooltipContent definition={definition} {...(instance ? { instance } : {})} />
    </TooltipPanel>,
    document.body,
  );
}
