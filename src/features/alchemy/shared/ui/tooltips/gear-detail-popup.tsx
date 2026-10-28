import { type RefObject } from "react";
import { type GearDefinition, type GearInstance } from "@/lib/gear";

import { GearTooltipContent } from "./gear-tooltip-content";
import { PortaledTooltip } from "./portaled-tooltip";
import { getPlasmaColorPairForGear } from "../../config";
import type { PortaledTooltipPlacement } from "./portaled-tooltip-placement";

export function GearDetailPopup({
  definition,
  instance,
  notice,
  padding,
  ...tooltipProps
}: {
  definition: GearDefinition | undefined;
  instance: GearInstance;
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
  padding?: number | undefined;
  notice?: string | undefined;
  placement?: PortaledTooltipPlacement;
  preservePlacementOnResize?: boolean;
}) {
  if (!definition) return null;
  return (
    <PortaledTooltip
      {...tooltipProps}
      {...(padding !== undefined ? { padding } : {})}
      className="rounded-shell-tooltip"
      plasmaColorPair={getPlasmaColorPairForGear(instance)}
    >
      <GearTooltipContent definition={definition} instance={instance} />
      {notice ? <p className="mt-3 text-sm text-warning">{notice}</p> : null}
    </PortaledTooltip>
  );
}
