// Hover detail popup for cards and collection tiles.
// Rendered root-scale via PortaledTooltip, sized to the trigger's rendered
// width, and interactive (pointer-events-auto) so nested keyword tooltips
// stay reachable.
// Used by battle cards, shop cards, and collection previews.
import { type ReactNode, type RefObject } from "react";

import type { BattleCard } from "@/lib/game-data";

import { DescriptionLines } from "./card-description-ui";
import { PortaledTooltip } from "./portaled-tooltip";
import { TooltipBody, TooltipHeader } from "./tooltip-panel";

export function DetailPopup({
  idPrefix,
  title,
  subtitle,
  descriptionLines,
  descriptionNodes,
  card,
  triggerRef,
  visible,
}: {
  idPrefix: string;
  title: ReactNode;
  subtitle: string | undefined;
  descriptionLines: string[];
  descriptionNodes?: ReactNode[];
  card?: Pick<BattleCard, "corruptedValuePositions">;
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
}) {
  return (
    <PortaledTooltip
      triggerRef={triggerRef}
      visible={visible}
      matchTriggerWidth
      pointerEventsAuto
      className="rounded-shell-tooltip"
    >
      <TooltipHeader>{title}</TooltipHeader>
      {subtitle ? <p className="mt-1 text-xs tracking-widest text-amber-100/80 uppercase">{subtitle}</p> : null}
      <DescriptionLines lines={descriptionLines} idPrefix={idPrefix} {...(card ? { card } : {})} />
      {descriptionNodes?.map((node, i) => (
        <TooltipBody key={i}>{node}</TooltipBody>
      ))}
    </PortaledTooltip>
  );
}
