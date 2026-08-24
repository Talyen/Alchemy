// Battle status icon popups for keyword statuses and Death's Door.
// Depends on keyword metadata/icons and shared tooltip panel.
// Used by ArtPanel to keep actor layout separate from status tooltip details.
import { type ReactNode } from "react";
import { Skull, Sparkles } from "lucide-react";
import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

import { keywordIcons, tooltipChipClass } from "../../config";
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
}: {
  ariaLabel: string;
  buttonClassName?: string;
  icon: ReactNode;
  tooltip: ReactNode;
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
      <PortaledTooltip triggerRef={triggerRef} visible={visible}>
        {tooltip}
      </PortaledTooltip>
    </div>
  );
}

/** Shared status tooltip: label row with optional value chip, then description body. */
function StatusTooltip({
  labelNode,
  value,
  hideValue,
  description,
}: {
  labelNode: ReactNode;
  value?: number;
  hideValue?: boolean | undefined;
  description: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {labelNode}
        {value !== undefined && !hideValue ? (
          <span className={cn("rounded-full bg-background px-2 py-0.5 text-foreground", tooltipChipClass)}>
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

  // Check augment definitions first (burnBonus, freezeBonus, etc.)
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
          description={renderColoredKeywords(definition.description)}
        />
      }
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
  return (
    <StatusChipShell
      ariaLabel={chip.hideValue ? augment.label : `${augment.label} ${chip.value}`}
      icon={<Icon className={cn("h-[2.7cqh] w-[2.7cqh]", augment.colorClass)} />}
      tooltip={
        <StatusTooltip
          labelNode={<TooltipHeader className="mb-0">{augment.label}</TooltipHeader>}
          value={chip.value}
          hideValue={chip.hideValue}
          description={augment.description}
        />
      }
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
          description="Skips the next enemy phase and grants another player turn."
        />
      }
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
    />
  );
}
