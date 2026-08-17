import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { controlLabelClass, settingsPanelShellClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
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
    <div className={cn(settingsPanelShellClass, "text-left")}>
      <label htmlFor="resolution" className={cn("block", controlLabelClass)}>
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
    <div className={cn(settingsPanelShellClass, "text-left")}>
      <label htmlFor="display-mode" className={cn("block", controlLabelClass)}>
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
