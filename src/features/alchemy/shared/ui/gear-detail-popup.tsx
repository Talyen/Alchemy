import { type GearDefinition, type GearInstance } from "@/lib/gear";

import { GearTooltipContent } from "./gear-tooltip-content";
import { TooltipPanel, useTooltipFlip } from "./tooltip-panel";

export function GearDetailPopup({
  definition,
  instance,
}: {
  definition: GearDefinition | undefined;
  instance: GearInstance;
}) {
  const { ref, flip } = useTooltipFlip();
  if (!definition) return null;
  return (
    <TooltipPanel ref={ref} flip={flip} width="w-full" className="pointer-events-auto rounded-shell-tooltip">
      <GearTooltipContent definition={definition} instance={instance} />
    </TooltipPanel>
  );
}
