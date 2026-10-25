import { useGameTranslation } from "@/components/use-game-translation";

import { type ReactNode, type RefObject } from "react";

import type { BattleCard, CardDescriptionInspection } from "@/lib/game-data";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

import { DescriptionLines } from "../cards/card-description-ui";
import { PortaledTooltip } from "./portaled-tooltip";
import { TooltipBody, TooltipChip, TooltipHeader, TooltipSubheader } from "./tooltip-panel";

export function DetailPopup({
  idPrefix,
  title,
  subtitle,
  chip,
  descriptionLines,
  descriptionNodes,
  newLineIndices,
  card,
  attackPreview,
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
  newLineIndices?: ReadonlySet<number> | undefined;
  card?: Pick<BattleCard, "effects" | "description"> | undefined;
  attackPreview?: CardDescriptionInspection["attackPreview"];
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
  padding?: number | undefined;
  plasmaColorPair?: PlasmaColorPair | null | undefined;
}) {
  const i18n = useGameTranslation();
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
      <DescriptionLines
        lines={descriptionLines}
        idPrefix={idPrefix}
        newLineIndices={newLineIndices}
        {...(card ? { card } : {})}
      />
      {attackPreview ? (
        <div className="mt-3 border-t border-foreground/15 pt-2" data-testid="card-attack-preview">
          <TooltipSubheader>{i18n.text("card.attack-preview", "Attack power")}</TooltipSubheader>
          <DescriptionLines
            lines={attackPreview.card.descriptionLines}
            idPrefix={`${idPrefix}-attack-preview`}
            card={attackPreview.card}
            onlyLines={attackPreview.lineIndices}
          />
        </div>
      ) : null}
      {descriptionNodes?.map((node, i) => (
        <TooltipBody key={i}>{i18n.displayText(node)}</TooltipBody>
      ))}
    </PortaledTooltip>
  );
}
