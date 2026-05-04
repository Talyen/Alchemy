import type { CSSProperties, MutableRefObject, ReactNode } from "react";
import { AlertTriangle, House, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { destinationMeta } from "../config";
import type { Destination, ResolutionOption } from "../types";

// Destination choice buttons shown after victory. Each destination gets its own
// color scheme from destinationMeta. Refs are stored so the controller can
// reference them (currently unused but available for focus management).
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
            ref={(node) => { buttonRefs.current[destination] = node; }}
            type="button"
            onClick={() => onChoose(destination)}
            className={cn("relative inline-flex min-h-[56px] items-center justify-start gap-2 overflow-hidden rounded-full border border-border/80 px-4 py-2 text-left text-sm font-semibold shadow-[0_12px_24px_rgba(0,0,0,0.26)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", destinationMeta[destination].className)}
          >
            <div className="relative flex items-center gap-2">
              <span className="rounded-full bg-black/16 p-1.5"><Icon className="h-4 w-4" /></span>
              <span className="leading-none">{destination}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Dropdown for selecting display resolution. The resolution is persisted to
// localStorage and applied via a virtual viewport wrapper (useVirtualResolution).
export function ResolutionSelect({ selectedResolution, resolutionOptions, onChange }: { selectedResolution: ResolutionOption; resolutionOptions: ResolutionOption[]; onChange: (resolution: ResolutionOption) => void }) {
  return (
    <div className="surface-muted rounded-[22px] border border-border/70 p-5 text-left">
      <label htmlFor="resolution" className="block text-sm font-semibold text-foreground">Resolution</label>
      <select id="resolution" value={selectedResolution} onChange={(event) => onChange(event.target.value as ResolutionOption)} className="mt-3 w-full rounded-[16px] border border-border/80 bg-background px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary">
        {resolutionOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
      </select>
    </div>
  );
}

// Modal confirmation dialog for destructive actions (clear save data, reset talents).
// Rendered as an absolutely-positioned overlay so the parent's layout is unaffected.
// Uses z-[120] to sit above the main content (z-[100] for defeat overlay).
export function ConfirmationDialog({ title, description, confirmLabel, cancelLabel = "Cancel", tone = "danger", onConfirm, onCancel }: { title: string; description: string; confirmLabel: string; cancelLabel?: string; tone?: "danger" | "default"; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/70 px-6">
      <div className="alchemy-shell w-full max-w-md rounded-[26px] border border-border/80 px-6 py-6 text-center shadow-[0_20px_48px_rgba(0,0,0,0.45)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-200"><AlertTriangle className="h-6 w-6" /></div>
        <h2 className="mt-4 text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === "danger" ? "destructive" : "default"} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// Shared shimmer animation overlay for card hover effects. Used in character select,
// battle hand, collection grid, and enemy/player art panels. The rounded prop varies
// because different card containers have different border radii (22px for character
// cards, 30px for battle cards).
export function ShimmerOverlay({ active, token, rounded = "rounded-[30px]" }: { active: boolean; token?: number; rounded?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-10 overflow-hidden", rounded, active ? "card-shimmer-active" : "")}>
      <div key={active ? token : undefined} className={cn("card-shimmer-sweep", active ? "opacity-100" : "opacity-0")} />
    </div>
  );
}

// Shared header bar used on Options, Talents, and Collection screens.
// Provides consistent navigation: Main Menu always visible, Return to Battle
// only when there's an active battle to return to.
export function ScreenHeader({ onMainMenu, onReturnToBattle, showReturnToBattle }: { onMainMenu: () => void; onReturnToBattle?: () => void; showReturnToBattle?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button variant="outline" onClick={onMainMenu}><House className="h-4 w-4" /> Main Menu</Button>
      {showReturnToBattle && onReturnToBattle ? <Button onClick={onReturnToBattle}><Swords className="h-4 w-4" /> Return to Battle</Button> : null}
    </div>
  );
}

// Generic progress bar used for XP progress and talent progress display.
// defaultValue determines the fill percentage (0-100). Callers can override color
// and pass additional style (e.g. transition timing for animations).
export function ProgressBar({ value, color = "bg-primary", className, style }: { value: number; color?: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%`, ...style }} />
    </div>
  );
}

// Universal page layout for consistent centering and spacing across all screens.
export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto px-4 py-6">
      {children}
    </div>
  );
}
