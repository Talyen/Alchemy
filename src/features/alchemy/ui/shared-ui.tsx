import type { CSSProperties, MutableRefObject, ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { destinationMeta, staticCardTransform } from "../config";
import type { Destination, DisplayMode, ResolutionOption, UiScale } from "../types";
import { clearTiltFromEvent, setTiltFromEvent } from "../utils";

// Destination choice buttons shown after victory. Each destination gets its own
// color scheme and art image. Tilt effects on the art are applied on hover.
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
    <div className="flex flex-wrap justify-center gap-8">
      {destinationOptions.map((destination, index) => {
        const { icon: Icon, className, art } = destinationMeta[destination];
        return (
          <div key={destination} className="stagger-item flex flex-col items-center gap-4" style={{ "--stagger-index": index } as CSSProperties}>
            <div
              className="tilt-surface rounded-[18px]"
              style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
              data-tilt-strength="12"
              onMouseMove={setTiltFromEvent}
              onMouseLeave={clearTiltFromEvent}
            >
              <img src={art} alt={destination} className="w-full max-w-[352px] rounded-[18px] object-contain" />
            </div>
            <button
              ref={(node) => { buttonRefs.current[destination] = node; }}
              type="button"
              onClick={() => onChoose(destination)}
              className={cn("inline-flex min-h-[48px] items-center justify-start gap-2 rounded-full border border-border/80 px-4 py-2 text-left text-sm font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", className)}
            >
              <span className="rounded-full bg-black/16 p-1.5"><Icon className="h-4 w-4" /></span>
              <span className="leading-none">{destination}</span>
            </button>
          </div>
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
      <Select value={selectedResolution} onValueChange={(value) => onChange(value as ResolutionOption)}>
        <SelectTrigger id="resolution" className="mt-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {resolutionOptions.map((option) => (<SelectItem key={option} value={option}>{option}</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Desktop-only native window mode selector. Browser builds omit this because
// Chromium pages cannot manage the outer OS window decoration or fullscreen mode.
export function DisplayModeSelect({ displayMode, displayModeOptions, onChange }: { displayMode: DisplayMode; displayModeOptions: Array<{ value: DisplayMode; label: string }>; onChange: (mode: DisplayMode) => void }) {
  return (
    <div className="surface-muted rounded-[22px] border border-border/70 p-5 text-left">
      <label htmlFor="display-mode" className="block text-sm font-semibold text-foreground">Display Mode</label>
      <Select value={displayMode} onValueChange={(value) => onChange(value as DisplayMode)}>
        <SelectTrigger id="display-mode" className="mt-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {displayModeOptions.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  );
}

// UI scale adjusts the root rem size, making text and interface controls easier
// to read without changing the selected virtual resolution/aspect ratio.
export function UiScaleSelect({ uiScale, uiScaleOptions, onChange }: { uiScale: UiScale; uiScaleOptions: Array<{ value: UiScale; label: string }>; onChange: (scale: UiScale) => void }) {
  return (
    <div className="surface-muted rounded-[22px] border border-border/70 p-5 text-left">
      <label htmlFor="ui-scale" className="block text-sm font-semibold text-foreground">UI Scale</label>
      <Select value={uiScale} onValueChange={(value) => onChange(value as UiScale)}>
        <SelectTrigger id="ui-scale" className="mt-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {uiScaleOptions.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label} ({option.value}%)</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Modal confirmation dialog for destructive actions (clear save data, reset talents).
// Rendered as an absolutely-positioned overlay so the parent's layout is unaffected.
// Uses z-[120] to sit above the main content (z-[100] for defeat overlay).
export function ConfirmationDialog({ title, description, confirmLabel, cancelLabel = "Cancel", tone = "danger", onConfirm, onCancel }: { title: string; description: string; confirmLabel: string; cancelLabel?: string; tone?: "danger" | "default"; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="motion-overlay absolute inset-0 z-[120] flex items-center justify-center bg-black/70 px-6">
      <div className="motion-panel alchemy-shell w-full max-w-md rounded-[26px] border border-border/80 px-6 py-6 text-center">
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

// Screen header repeats the route marker styling so top-level screens feel like
// entries in the same travel journal rather than isolated panels.
export function ScreenHeader({ title, className }: { title: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <h1 className="text-lg font-black uppercase tracking-[0.15em] text-amber-100/75 sm:text-xl">
        {title}
      </h1>
      <div className="mt-2 h-px w-44 bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
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

// Generic progress bar used for XP progress and talent progress display.
// defaultValue determines the fill percentage (0-100). Callers can override color
// and pass additional style (e.g. transition timing for animations).
export function ProgressBar({ value, color = "bg-primary", className, style }: { value: number; color?: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%`, ...style }} />
    </div>
  );
}

// Gold cost display with coin icon. Shared by merchant and alchemist shops.
export function GoldCost({ amount }: { amount: number }) {
  return <span className="flex items-center gap-1 text-xs text-yellow-300"><Coins className="h-3 w-3" />{amount}</span>;
}

// Prev/Next pagination controls with page counter. Supports two visual sizes.
export function PaginationControls({ page, totalPages, onPageChange, size = "sm", reserveSpace = false }: { page: number; totalPages: number; onPageChange: (page: number) => void; size?: "sm" | "default"; reserveSpace?: boolean }) {
  const buttonClass = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const widthClass = size === "sm" ? "max-w-28" : "max-w-36";

  if (totalPages <= 1) {
    return reserveSpace ? <div className={cn("mt-4 min-h-[44px] w-full", widthClass)} aria-hidden="true" /> : null;
  }

  return (
    <div className={cn("mt-4 flex min-h-[44px] w-full items-center justify-center gap-4", widthClass)}>
      <Button aria-label="Previous page" className={buttonClass} variant="outline" size="icon" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Button aria-label="Next page" className={buttonClass} variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

// Universal page layout for consistent centering and spacing across all screens.
export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="game-page-scroll flex h-full w-full flex-col items-center justify-center overflow-x-hidden overflow-y-auto px-4 py-6">
      {children}
    </div>
  );
}

// Wraps disabled buttons to show a hover tooltip explaining why it's disabled.
export function DisabledTooltip({ show, message, children }: { show: boolean; message: string; children: ReactNode }) {
  if (!show) return <>{children}</>;
  return (
    <div className="relative group">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-black/90 px-3 py-1.5 text-xs text-white opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
        {message}
      </div>
    </div>
  );
}
