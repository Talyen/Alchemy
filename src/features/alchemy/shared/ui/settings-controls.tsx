import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

export function SettingsSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className={settingsPanelShellClass}>
      <div className="flex items-center justify-between gap-4">
        <p className={controlLabelClass}>{label}</p>
        <p className={cn(controlLabelClass, "text-primary")}>{value}%</p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="mt-3 w-full accent-primary"
      />
    </div>
  );
}

export function SettingsToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={settingsPanelShellClass}>
      <div className="flex items-center justify-between gap-4">
        <p className={controlLabelClass}>{label}</p>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}
