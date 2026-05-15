import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DisplayMode, ResolutionOption, UiScale } from "../types";

export function ResolutionSelect({ selectedResolution, resolutionOptions, onChange }: { selectedResolution: ResolutionOption; resolutionOptions: Array<{ value: ResolutionOption; label: string }>; onChange: (resolution: ResolutionOption) => void }) {
  return (
    <div className="surface-muted rounded-[22px] border border-border/70 p-5 text-left">
      <label htmlFor="resolution" className="block text-sm font-semibold text-foreground">Aspect Ratio</label>
      <Select value={selectedResolution} onValueChange={(value) => onChange(value as ResolutionOption)}>
        <SelectTrigger id="resolution" className="mt-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {resolutionOptions.map(({ value, label }) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  );
}

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
