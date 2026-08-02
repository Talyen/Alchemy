import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AspectRatioOption, DisplayMode } from "../types";

export function AspectRatioSelect({
  selectedAspectRatio,
  aspectRatioOptions,
  onChange,
}: {
  selectedAspectRatio: AspectRatioOption;
  aspectRatioOptions: Array<{ value: AspectRatioOption; label: string }>;
  onChange: (aspectRatio: AspectRatioOption) => void;
}) {
  return (
    <div className="rounded-shell-panel border border-border/70 p-5 text-left surface-muted">
      <label htmlFor="resolution" className="block text-sm font-semibold text-foreground">
        Aspect Ratio
      </label>
      <Select value={selectedAspectRatio} onValueChange={(value) => onChange(value as AspectRatioOption)}>
        <SelectTrigger id="resolution" className="mt-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {aspectRatioOptions.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DisplayModeSelect({
  displayMode,
  displayModeOptions,
  onChange,
}: {
  displayMode: DisplayMode;
  displayModeOptions: Array<{ value: DisplayMode; label: string }>;
  onChange: (mode: DisplayMode) => void;
}) {
  return (
    <div className="rounded-shell-panel border border-border/70 p-5 text-left surface-muted">
      <label htmlFor="display-mode" className="block text-sm font-semibold text-foreground">
        Display Mode
      </label>
      <Select value={displayMode} onValueChange={(value) => onChange(value as DisplayMode)}>
        <SelectTrigger id="display-mode" className="mt-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {displayModeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
