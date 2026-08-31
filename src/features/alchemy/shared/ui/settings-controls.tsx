import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { controlLabelClass, settingsPanelShellClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import type { AspectRatioOption, DisplayMode } from "../types";

interface SettingsSelectProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

function SettingsSelect<T extends string>({ id, label, value, options, onChange }: SettingsSelectProps<T>) {
  return (
    <div className={cn(settingsPanelShellClass, "text-left")}>
      <label htmlFor={id} className={cn("block", controlLabelClass)}>
        {label}
      </label>
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue as T)}>
        <SelectTrigger id={id} className="mt-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AspectRatioSelect({
  selectedAspectRatio,
  aspectRatioOptions,
  onChange,
}: {
  selectedAspectRatio: AspectRatioOption;
  aspectRatioOptions: ReadonlyArray<{ value: AspectRatioOption; label: string }>;
  onChange: (aspectRatio: AspectRatioOption) => void;
}) {
  return (
    <SettingsSelect
      id="resolution"
      label="Aspect Ratio"
      value={selectedAspectRatio}
      options={aspectRatioOptions}
      onChange={onChange}
    />
  );
}

export function DisplayModeSelect({
  displayMode,
  displayModeOptions,
  onChange,
}: {
  displayMode: DisplayMode;
  displayModeOptions: ReadonlyArray<{ value: DisplayMode; label: string }>;
  onChange: (mode: DisplayMode) => void;
}) {
  return (
    <SettingsSelect
      id="display-mode"
      label="Display Mode"
      value={displayMode}
      options={displayModeOptions}
      onChange={onChange}
    />
  );
}
