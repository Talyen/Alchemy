import { type ReactNode } from "react";
import { Skull, Sparkles } from "lucide-react";
import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

import {
  DEATHS_DOOR_PLASMA_PAIR,
  getPlasmaColorPair,
  getPlasmaKeywordsForText,
  HASTE_PLASMA_PAIR,
  keywordIcons,
} from "../../config";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
import { augmentDefinitions } from "../../augment-definitions";
import type { StatusChip } from "../../types";
import { renderColoredKeywords } from "../card-description-ui";
import { KeywordTag } from "../keyword-tag";
import { PortaledTooltip } from "../portaled-tooltip";
import { TooltipBody, TooltipHeader } from "../tooltip-panel";
import { useHoverVisible } from "../use-hover-visible";

function StatusChipShell({
  ariaLabel,
  buttonClassName,
  icon,
  tooltip,
  plasmaColorPair,
}: {
  ariaLabel: string;
  buttonClassName?: string;
  icon: ReactNode;
  tooltip: ReactNode;
  plasmaColorPair?: PlasmaColorPair | null;
}) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLButtonElement>();

  return (
    <div className="status-chip-pop relative flex items-center justify-center">
      <button
        ref={triggerRef}
        type="button"
        className={cn("relative flex h-9 w-9 items-center justify-center", buttonClassName)}
        aria-label={ariaLabel}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
      >
        {icon}
      </button>
      <PortaledTooltip triggerRef={triggerRef} visible={visible} plasmaColorPair={plasmaColorPair}>
        {tooltip}
      </PortaledTooltip>
    </div>
  );
}

function StatusTooltip({
  labelNode,
  value,
  hideValue,
  valueColorClass,
  description,
}: {
  labelNode: ReactNode;
  value?: number;
  hideValue?: boolean | undefined;
  valueColorClass?: string;
  description: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {labelNode}
        {value !== undefined && !hideValue ? (
          <span
            className={cn(
              "rounded-full border border-border/70 bg-stone-900/60 px-2.5 py-0.5 text-sm font-bold",
              valueColorClass,
            )}
          >
            {value}
          </span>
        ) : null}
      </div>
      <TooltipBody>
        <p>{description}</p>
      </TooltipBody>
    </>
  );
}

export function StatusIcon({ chip }: { chip: StatusChip }) {
  if (chip.id === "haste") {
    return <HasteStatusIcon value={chip.value} />;
  }

  const augment = augmentDefinitions[chip.id as keyof typeof augmentDefinitions];
  if (augment) {
    return <AugmentStatusIcon chip={chip} augment={augment} />;
  }

  const kw = chip.id as KeywordId;
  const definition = keywordDefinitions[kw];
  const Icon = keywordIcons[kw];

  if (!definition || !Icon) {
    return null;
  }

  return (
    <StatusChipShell
      ariaLabel={`${definition.label} ${chip.value}`}
      icon={<Icon className={cn("h-[2.7cqh] w-[2.7cqh]", definition.colorClass)} />}
      tooltip={
        <StatusTooltip
          labelNode={<KeywordTag keywordId={kw} className="text-sm sm:text-base" />}
          value={chip.value}
          valueColorClass={definition.colorClass}
          description={renderColoredKeywords(definition.description)}
        />
      }
      plasmaColorPair={getPlasmaColorPair([kw])}
    />
  );
}

function AugmentStatusIcon({
  chip,
  augment,
}: {
  chip: StatusChip;
  augment: (typeof augmentDefinitions)[keyof typeof augmentDefinitions];
}) {
  const Icon = augment.icon;
  const plasmaColorPair = getPlasmaColorPair(getPlasmaKeywordsForText(`${augment.label} ${augment.description}`));
  return (
    <StatusChipShell
      ariaLabel={chip.hideValue ? augment.label : `${augment.label} ${chip.value}`}
      icon={<Icon className={cn("h-[2.7cqh] w-[2.7cqh]", augment.colorClass)} />}
      tooltip={
        <StatusTooltip
          labelNode={<TooltipHeader className="mb-0">{augment.label}</TooltipHeader>}
          value={chip.value}
          hideValue={chip.hideValue}
          valueColorClass={augment.colorClass}
          description={augment.description}
        />
      }
      plasmaColorPair={plasmaColorPair}
    />
  );
}

function HasteStatusIcon({ value }: { value: number }) {
  return (
    <StatusChipShell
      ariaLabel={`Haste ${value}`}
      icon={<Sparkles className="h-[2.7cqh] w-[2.7cqh] text-fuchsia-300" />}
      tooltip={
        <StatusTooltip
          labelNode={<TooltipHeader className="mb-0">Haste</TooltipHeader>}
          value={value}
          valueColorClass="text-fuchsia-300"
          description="Skips the next enemy phase and grants another player turn."
        />
      }
      plasmaColorPair={HASTE_PLASMA_PAIR}
    />
  );
}

export function DeathsDoorStatusIcon() {
  return (
    <StatusChipShell
      ariaLabel="Death's Door"
      buttonClassName="rounded-full bg-red-950/70 text-red-200 ring-1 ring-red-400/60"
      icon={<Skull className="h-[2.7cqh] w-[2.7cqh]" />}
      tooltip={
        <>
          <TooltipHeader>Death's Door</TooltipHeader>
          <TooltipBody className="italic">
            <p>
              Because I could not stop for Death,
              <br />
              He kindly stopped for me
            </p>
          </TooltipBody>
        </>
      }
      plasmaColorPair={DEATHS_DOOR_PLASMA_PAIR}
    />
  );
}
