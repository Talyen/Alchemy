// Battle status icon popups for keyword statuses and Death's Door.
// Depends on keyword metadata/icons and shared popup/card description rendering.
// Used by ArtPanel to keep actor layout separate from status tooltip details.
import { Skull, Sparkles } from "lucide-react";

import { keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { keywordIcons, popupClassName } from "../../config";
import type { StatusChip } from "../../types";
import { renderColoredKeywords } from "../card-description-ui";
import { KeywordTag } from "../keyword-tag";

export function StatusIcon({ chip }: { chip: StatusChip }) {
  if (chip.id === "haste") {
    return <HasteStatusIcon value={chip.value} />;
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
        className="relative flex h-7 w-7 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`${definition.label} ${chip.value}`}
      >
        <Icon className={cn("h-[1.67cqh] w-[1.67cqh]", definition.colorClass)} />
      </button>
      <div
        className={cn(popupClassName, "hover-popup-panel pointer-events-none opacity-0 group-hover/status:opacity-100")}
      >
        <div className="flex items-center justify-between gap-3">
          <KeywordTag keywordId={kw} />
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-foreground">
            {chip.value}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{renderColoredKeywords(definition.description)}</p>
      </div>
    </div>
  );
}

function HasteStatusIcon({ value }: { value: number }) {
  return (
    <div className="status-chip-pop group/status relative flex items-center justify-center">
      <button
        type="button"
        className="relative flex h-7 w-7 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Haste ${value}`}
      >
        <Sparkles className="h-[1.67cqh] w-[1.67cqh] text-fuchsia-300" />
      </button>
      <div
        className={cn(popupClassName, "hover-popup-panel pointer-events-none opacity-0 group-hover/status:opacity-100")}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300 px-2.5 py-1 text-xs font-semibold uppercase tracking-widest text-fuchsia-300">
            <Sparkles className="h-3.5 w-3.5" /> Haste
          </span>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-foreground">{value}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Skips the next enemy phase and grants another player turn.
        </p>
      </div>
    </div>
  );
}

export function DeathsDoorStatusIcon() {
  return (
    <div className="status-chip-pop group/status relative flex items-center justify-center">
      <button
        type="button"
        className="relative flex h-7 w-7 items-center justify-center rounded-full bg-red-950/70 text-red-200 ring-1 ring-red-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Death's Door"
      >
        <Skull className="h-[1.67cqh] w-[1.67cqh]" />
      </button>
      <div
        className={cn(
          popupClassName,
          "w-72 hover-popup-panel pointer-events-none opacity-0 group-hover/status:opacity-100",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-400/50 bg-red-950/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-widest text-red-200">
            <Skull className="h-3.5 w-3.5" /> Death's Door
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 italic text-muted-foreground">
          Because I could not stop for Death,
          <br />
          He kindly stopped for me
        </p>
      </div>
    </div>
  );
}
