// Hover detail popup for cards and collection tiles.
// Rendered root-scale via PortaledTooltip (content-sized, capped at tooltipWidthClass).
// Used by battle cards, shop cards, and collection previews.
import { type ReactNode, type RefObject } from "react";

import type { BattleCard } from "@/lib/game-data";

import { DescriptionLines } from "./card-description-ui";
import { PortaledTooltip } from "./portaled-tooltip";
import { TooltipBody, TooltipChip, TooltipHeader, TooltipSubheader } from "./tooltip-panel";

export function DetailPopup({
  idPrefix,
  title,
  subtitle,
  footerChip,
  descriptionLines,
  descriptionNodes,
  card,
  triggerRef,
  visible,
  padding,
}: {
  idPrefix: string;
  title: ReactNode;
  subtitle?: string | undefined;
  footerChip?: string | undefined;
  descriptionLines: string[];
  descriptionNodes?: ReactNode[] | undefined;
  card?: Pick<BattleCard, "corruptedValuePositions"> | undefined;
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
  padding?: number | undefined;
}) {
  return (
    <PortaledTooltip
      triggerRef={triggerRef}
      visible={visible}
      className="rounded-shell-tooltip"
      {...(padding !== undefined ? { padding } : {})}
    >
      <TooltipHeader>{title}</TooltipHeader>
      {subtitle ? <TooltipSubheader className="mt-1">{subtitle}</TooltipSubheader> : null}
      <DescriptionLines lines={descriptionLines} idPrefix={idPrefix} {...(card ? { card } : {})} />
      {descriptionNodes?.map((node, i) => (
        <TooltipBody key={i}>{node}</TooltipBody>
      ))}
      {footerChip ? <TooltipChip>{footerChip}</TooltipChip> : null}
    </PortaledTooltip>
  );
}
