import { useSelectDismiss } from "../../../shared/ui/use-select-dismiss";
import { useId, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { controlLabelClass, controlDescriptionClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import type { AspectRatioOption, DisplayMode } from "../../../shared/types";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="options-settings-heading text-base font-semibold text-gold-pale">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsAction({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="options-settings-row options-settings-action">
      <div className="options-settings-label">
        <p className={controlLabelClass}>{label}</p>
        <p className={cn("options-settings-description", controlDescriptionClass)}>{description}</p>
      </div>
      <div className="options-settings-control flex justify-end">{children}</div>
    </div>
  );
}

interface SettingsSelectProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

function SettingsSelect<T extends string>({ id, label, value, options, onChange }: SettingsSelectProps<T>) {
  const selectDismiss = useSelectDismiss();
  return (
    <div className="options-settings-row">
      <label htmlFor={id} className={cn("options-settings-label", controlLabelClass)}>
        {label}
      </label>
      <Select {...selectDismiss} value={value} onValueChange={(nextValue) => onChange(nextValue as T)}>
        <SelectTrigger id={id} className="options-settings-control py-2">
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
      id="aspect-ratio"
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
    <div className="options-settings-row">
      <p className={cn("options-settings-label", controlLabelClass)}>{label}</p>
      <div className="options-settings-control flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
          className="h-8 min-w-0 flex-1 cursor-pointer accent-primary"
        />
        <p className="w-14 shrink-0 text-right text-lg font-semibold text-primary tabular-nums">{value}%</p>
      </div>
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
  const id = useId();
  return (
    <div className="options-settings-row options-settings-toggle">
      <label htmlFor={id} className={cn("min-w-0 flex-1 cursor-pointer", controlLabelClass)}>
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
