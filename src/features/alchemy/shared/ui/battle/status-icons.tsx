// Battle status icon popups for keyword statuses and Death's Door.
// Depends on keyword metadata/icons and shared tooltip panel.
// Used by ArtPanel to keep actor layout separate from status tooltip details.
import { useRef, useState, type ReactNode } from "react";
import { Skull, Sparkles } from "lucide-react";

import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

import { keywordIcons } from "../../config";
import { augmentDefinitions } from "../../augment-definitions";
import type { StatusChip } from "../../types";
import { renderColoredKeywords } from "../card-description-ui";
import { KeywordTag } from "../keyword-tag";
import { PortaledTooltip } from "../portaled-tooltip";
import { TooltipBody, TooltipHeader } from "../tooltip-panel";

function StatusChipShell({
  ariaLabel,
  buttonClassName,
  icon,
  tooltip,
  width = "w-72",
}: {
  ariaLabel: string;
  buttonClassName?: string;
  icon: ReactNode;
  tooltip: ReactNode;
  width?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  return (
    <div className="status-chip-pop relative flex items-center justify-center">
      <button
        ref={triggerRef}
        type="button"
        className={cn("relative flex h-9 w-9 items-center justify-center", buttonClassName)}
        aria-label={ariaLabel}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        {icon}
      </button>
      <PortaledTooltip triggerRef={triggerRef} visible={visible} width={width}>
        {tooltip}
      </PortaledTooltip>
    </div>
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
      icon={<Icon className={cn("h-[2.3cqh] w-[2.3cqh]", definition.colorClass)} />}
      tooltip={
        <>
          <div className="flex items-center justify-between gap-3">
            <KeywordTag keywordId={kw} />
            <span className="rounded-full bg-background px-2 py-0.5 text-base font-semibold text-foreground">
              {chip.value}
            </span>
          </div>
          <TooltipBody>
            <p>{renderColoredKeywords(definition.description)}</p>
          </TooltipBody>
        </>
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
      ariaLabel={`${augment.label} ${chip.value}`}
      icon={<Icon className={cn("h-[2.3cqh] w-[2.3cqh]", augment.colorClass)} />}
      tooltip={
        <>
          <div className="flex items-center justify-between gap-3">
            <TooltipHeader className="mb-0">{augment.label}</TooltipHeader>
            <span className="rounded-full bg-background px-2 py-0.5 text-base font-semibold text-foreground">
              {chip.value}
            </span>
          </div>
          <TooltipBody>
            <p>{augment.description}</p>
          </TooltipBody>
        </>
      }
    />
  );
}

function HasteStatusIcon({ value }: { value: number }) {
  return (
    <StatusChipShell
      ariaLabel={`Haste ${value}`}
      icon={<Sparkles className="h-[2.3cqh] w-[2.3cqh] text-fuchsia-300" />}
      tooltip={
        <>
          <div className="flex items-center justify-between gap-3">
            <TooltipHeader className="mb-0">Haste</TooltipHeader>
            <span className="rounded-full bg-background px-2 py-0.5 text-base font-semibold text-foreground">
              {value}
            </span>
          </div>
          <TooltipBody>
            <p>Skips the next enemy phase and grants another player turn.</p>
          </TooltipBody>
        </>
      }
    />
  );
}

export function DeathsDoorStatusIcon() {
  return (
    <StatusChipShell
      ariaLabel="Death's Door"
      buttonClassName="rounded-full bg-red-950/70 text-red-200 ring-1 ring-red-400/60"
      icon={<Skull className="h-[2.3cqh] w-[2.3cqh]" />}
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
