// Hover detail popup for cards and collection tiles.
// Depends on direct layout measurement, shared popup styles, and description rendering.
// Used by battle cards, shop cards, and collection previews.
import { type ReactNode } from "react";

import type { BattleCard } from "@/lib/game-data";

import { DescriptionLines } from "./card-description-ui";
import { TooltipBody, TooltipHeader, TooltipPanel, useTooltipFlip } from "./tooltip-panel";

export function DetailPopup({
  idPrefix,
  title,
  subtitle,
  descriptionLines,
  descriptionNodes,
  card,
}: {
  idPrefix: string;
  title: ReactNode;
  subtitle: string | undefined;
  descriptionLines: string[];
  descriptionNodes?: ReactNode[];
  card?: Pick<BattleCard, "corruptedValuePositions">;
}) {
  const { ref, flip } = useTooltipFlip();

  return (
    <TooltipPanel ref={ref} flip={flip} width="w-full" className="pointer-events-auto rounded-shell-tooltip">
      <TooltipHeader>{title}</TooltipHeader>
      {subtitle ? <p className="mt-1 text-xs uppercase tracking-widest text-amber-100/80">{subtitle}</p> : null}
      <DescriptionLines lines={descriptionLines} idPrefix={idPrefix} {...(card ? { card } : {})} />
      {descriptionNodes?.map((node, i) => (
        <TooltipBody key={i}>{node}</TooltipBody>
      ))}
    </TooltipPanel>
  );
}
