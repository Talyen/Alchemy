import { type ReactNode, type RefObject } from "react";

import type { BattleCard } from "@/lib/game-data";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

import { DescriptionLines } from "./card-description-ui";
import { PortaledTooltip } from "./portaled-tooltip";
import { TooltipBody, TooltipChip, TooltipHeader, TooltipSubheader } from "./tooltip-panel";

export function DetailPopup({
  idPrefix,
  title,
  subtitle,
  chip,
  descriptionLines,
  descriptionNodes,
  card,
  triggerRef,
  visible,
  padding,
  plasmaColorPair,
}: {
  idPrefix: string;
  title: ReactNode;
  subtitle?: string | undefined;
  chip?: string | undefined;
  descriptionLines: string[];
  descriptionNodes?: ReactNode[] | undefined;
  card?: Pick<BattleCard, "corruptedValuePositions"> | undefined;
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
  padding?: number | undefined;
  plasmaColorPair?: PlasmaColorPair | null | undefined;
}) {
  return (
    <PortaledTooltip
      triggerRef={triggerRef}
      visible={visible}
      className="rounded-shell-tooltip"
      plasmaColorPair={plasmaColorPair}
      {...(padding !== undefined ? { padding } : {})}
    >
      <TooltipHeader className={chip ? "flex flex-wrap items-center gap-2" : undefined}>
        {title}
        {chip ? <TooltipChip className="shrink-0 whitespace-nowrap">{chip}</TooltipChip> : null}
      </TooltipHeader>
      {subtitle ? <TooltipSubheader className="mt-1">{subtitle}</TooltipSubheader> : null}
      <DescriptionLines lines={descriptionLines} idPrefix={idPrefix} {...(card ? { card } : {})} />
      {descriptionNodes?.map((node, i) => (
        <TooltipBody key={i}>{node}</TooltipBody>
      ))}
    </PortaledTooltip>
  );
}
