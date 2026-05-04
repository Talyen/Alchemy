import type { MutableRefObject } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { destinationMeta } from "../config";
import type { Destination, ResolutionOption } from "../types";

export function DestinationChoices({
  destinationOptions,
  onChoose,
  buttonRefs,
}: {
  destinationOptions: Destination[];
  onChoose: (destination: Destination) => void;
  buttonRefs: MutableRefObject<Partial<Record<Destination, HTMLButtonElement | null>>>;
}) {
  return (
    <div className="mt-14 flex flex-wrap justify-center gap-3">
      {destinationOptions.map((destination) => {
        const Icon = destinationMeta[destination].icon;

        return (
          <button
            key={destination}
            ref={(node) => {
              buttonRefs.current[destination] = node;
            }}
            type="button"
            onClick={() => onChoose(destination)}
            className={cn(
              "relative inline-flex min-h-[56px] items-center justify-start gap-2 overflow-hidden rounded-full border border-border/80 px-4 py-2 text-left text-sm font-semibold shadow-[0_12px_24px_rgba(0,0,0,0.26)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              destinationMeta[destination].className,
            )}
          >
            <div className="relative flex items-center gap-2">
              <span className="rounded-full bg-black/16 p-1.5">
                <Icon className="h-4 w-4" />
              </span>
              <span className="leading-none">{destination}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function ResolutionSelect({
  selectedResolution,
  resolutionOptions,
  onChange,
}: {
  selectedResolution: ResolutionOption;
  resolutionOptions: ResolutionOption[];
  onChange: (resolution: ResolutionOption) => void;
}) {
  return (
    <div className="surface-muted rounded-[22px] border border-border/70 p-5 text-left">
      <label htmlFor="resolution" className="block text-sm font-semibold text-foreground">
        Resolution
      </label>
      <select
        id="resolution"
        value={selectedResolution}
        onChange={(event) => onChange(event.target.value as ResolutionOption)}
        className="mt-3 w-full rounded-[16px] border border-border/80 bg-background px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary"
      >
        {resolutionOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/70 px-6">
      <div className="alchemy-shell w-full max-w-md rounded-[26px] border border-border/80 px-6 py-6 text-center shadow-[0_20px_48px_rgba(0,0,0,0.45)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-200">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>

        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
