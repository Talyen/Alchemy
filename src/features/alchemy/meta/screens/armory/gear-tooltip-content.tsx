import { getGearInstanceTooltipLines, type GearDefinition, type GearInstance } from "@/lib/gear";
import { GearItemTitle } from "../../../shared/ui/gear-item-title";
import { renderColoredKeywords } from "../../../shared/ui/card-description-ui";
import { TooltipBody, TooltipHeader } from "../../../shared/ui/tooltip-panel";

export function GearTooltipContent({
  definition,
  instance,
}: {
  definition: GearDefinition;
  instance?: GearInstance | undefined;
}) {
  const lines = instance
    ? getGearInstanceTooltipLines(instance)
    : definition.descriptionLines.map((text, index) => ({ key: `definition-${index}`, text }));

  return (
    <div>
      <TooltipHeader>{instance ? <GearItemTitle instance={instance} /> : definition.title}</TooltipHeader>
      <TooltipBody>
        {lines.map((line) => (
          <p key={line.key} className="text-sm text-muted-foreground">
            {renderColoredKeywords(line.text)}
          </p>
        ))}
      </TooltipBody>
    </div>
  );
}
