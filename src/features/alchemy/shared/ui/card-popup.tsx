// Hover detail popup for cards and collection tiles.
// Depends on direct layout measurement, shared popup styles, and description rendering.
// Used by battle cards, shop cards, and collection previews.
import { type CSSProperties, type ReactNode } from "react";

import type { BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { DescriptionLines } from "./card-description-ui";
import { TooltipBody, TooltipHeader, useTooltipFlip } from "./tooltip-panel";

const CARD_POPUP_CONFIG = {
  belowTop: "100%",
  belowTransform: "translate(-50%, 12px)",
  aboveTransform: "translate(-50%, calc(-100% - 26px))",
} as const;

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
    <div
      ref={ref}
      className={cn(
        "hover-popup-panel absolute left-1/2 z-40 w-full origin-bottom rounded-shell-tooltip border border-border/80 bg-card px-3 py-3 text-left",
        "pointer-events-auto",
      )}
      style={
        {
          top: flip ? CARD_POPUP_CONFIG.belowTop : 0,
          transform: flip ? CARD_POPUP_CONFIG.belowTransform : CARD_POPUP_CONFIG.aboveTransform,
        } as CSSProperties
      }
    >
      <TooltipHeader>{title}</TooltipHeader>
      {subtitle ? <p className="mt-1 text-xs uppercase tracking-widest text-amber-100/80">{subtitle}</p> : null}
      <DescriptionLines lines={descriptionLines} idPrefix={idPrefix} {...(card ? { card } : {})} />
      {descriptionNodes?.map((node, i) => (
        <TooltipBody key={i}>{node}</TooltipBody>
      ))}
    </div>
  );
}
