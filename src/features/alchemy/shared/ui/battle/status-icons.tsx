// Battle status icon popups for keyword statuses and Death's Door.
// Depends on keyword metadata/icons and shared tooltip panel.
// Used by ArtPanel to keep actor layout separate from status tooltip details.
import { Skull, Sparkles } from "lucide-react";

import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

import { keywordIcons } from "../../config";
import { augmentDefinitions } from "../../augment-definitions";
import type { StatusChip } from "../../types";
import { renderColoredKeywords } from "../card-description-ui";
import { KeywordTag } from "../keyword-tag";
import { TooltipPanel, TooltipBody } from "../tooltip-panel";

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
    <div className="status-chip-pop group/status relative flex items-center justify-center">
      <button
        type="button"
        className="relative flex h-7 w-7 items-center justify-center"
        aria-label={`${definition.label} ${chip.value}`}
      >
        <Icon className={cn("h-[1.67cqh] w-[1.67cqh]", definition.colorClass)} />
      </button>
      <TooltipPanel className="pointer-events-none opacity-0 group-hover/status:opacity-100">
        <div className="flex items-center justify-between gap-3">
          <KeywordTag keywordId={kw} />
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-foreground">
            {chip.value}
          </span>
        </div>
        <TooltipBody>
          <p>{renderColoredKeywords(definition.description)}</p>
        </TooltipBody>
      </TooltipPanel>
    </div>
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
    <div className="status-chip-pop group/status relative flex items-center justify-center">
      <button
        type="button"
        className="relative flex h-7 w-7 items-center justify-center"
        aria-label={`${augment.label} ${chip.value}`}
      >
        <Icon className={cn("h-[1.67cqh] w-[1.67cqh]", augment.colorClass)} />
      </button>
      <TooltipPanel className="pointer-events-none opacity-0 group-hover/status:opacity-100">
        <div className="flex items-center justify-between gap-3">
          <span className="font-sans text-lg font-bold text-foreground">{augment.label}</span>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-foreground">
            {chip.value}
          </span>
        </div>
        <TooltipBody>
          <p>{augment.description}</p>
        </TooltipBody>
      </TooltipPanel>
    </div>
  );
}

function HasteStatusIcon({ value }: { value: number }) {
  return (
    <div className="status-chip-pop group/status relative flex items-center justify-center">
      <button type="button" className="relative flex h-7 w-7 items-center justify-center" aria-label={`Haste ${value}`}>
        <Sparkles className="h-[1.67cqh] w-[1.67cqh] text-fuchsia-300" />
      </button>
      <TooltipPanel className="pointer-events-none opacity-0 group-hover/status:opacity-100">
        <div className="flex items-center justify-between gap-3">
          <span className="font-sans text-lg font-bold text-foreground">Haste</span>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-foreground">{value}</span>
        </div>
        <TooltipBody>
          <p>Skips the next enemy phase and grants another player turn.</p>
        </TooltipBody>
      </TooltipPanel>
    </div>
  );
}

export function DeathsDoorStatusIcon() {
  return (
    <div className="status-chip-pop group/status relative flex items-center justify-center">
      <button
        type="button"
        className={cn(
          "relative flex h-7 w-7 items-center justify-center rounded-full bg-red-950/70 text-red-200 ring-1 ring-red-400/60",
        )}
        aria-label="Death's Door"
      >
        <Skull className="h-[1.67cqh] w-[1.67cqh]" />
      </button>
      <TooltipPanel width="w-72" className="pointer-events-none opacity-0 group-hover/status:opacity-100">
        <div className="flex items-center justify-between gap-3">
          <span className="font-sans text-lg font-bold text-foreground">Death's Door</span>
        </div>
        <TooltipBody className="italic">
          <p>
            Because I could not stop for Death,
            <br />
            He kindly stopped for me
          </p>
        </TooltipBody>
      </TooltipPanel>
    </div>
  );
}
