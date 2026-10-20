import { isFocusNavigationEnabled } from "@/features/alchemy/shared/ui/focus-input";
import type { LucideIcon } from "lucide-react";
import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import { useModalEscapeDismiss } from "../../../shared/ui/use-modal-escape-dismiss";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { useState } from "react";
import { useId, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { playUISound } from "@/lib/audio";
import { controlLabelClass, controlDescriptionClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";

function SettingsIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden="true" className="flex h-[1lh] w-6 shrink-0 items-center justify-center self-start">
      <Icon className="text-gold-pale" />
    </span>
  );
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  useGameTranslation();
  return (
    <section>
      <h2 className="options-settings-heading text-base font-semibold text-gold-pale">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsAction({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  children: ReactNode;
}) {
  useGameTranslation();
  return (
    <div className="options-settings-row options-settings-action">
      <div className="options-settings-label">
        <p className={cn("options-settings-label-content", controlLabelClass)}>
          <SettingsIcon icon={Icon} />
          <span>{label}</span>
        </p>
        <p className={cn("options-settings-description pl-10", controlDescriptionClass)}>{description}</p>
      </div>
      <div className="options-settings-control flex justify-end">{children}</div>
    </div>
  );
}

interface SettingsSelectProps<T extends string> {
  id: string;
  icon: LucideIcon;
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; native?: boolean }>;
  onChange: (value: T) => void;
}

export function SettingsSelect<T extends string>({
  icon: Icon,
  id,
  label,
  value,
  options,
  onChange,
}: SettingsSelectProps<T>) {
  const i18n = useGameTranslation();
  const [open, setOpen] = useState(false);
  // Radix listens below our window capture listener. Register its open state so
  // Escape closes a select before it can dismiss the surrounding screen or dialog.
  useModalEscapeDismiss({
    active: open,
    id: "select",
    priority: ESCAPE_PRIORITY.SELECT,
    onEscape: () => setOpen(false),
  });
  return (
    <div className="options-settings-row">
      <label htmlFor={id} className={cn("options-settings-label options-settings-label-content", controlLabelClass)}>
        <SettingsIcon icon={Icon} />
        <span>{label}</span>
      </label>
      <Select
        open={open}
        onOpenChange={setOpen}
        value={value}
        onValueChange={(nextValue) => {
          onChange(nextValue as T);
          if (nextValue !== value) playUISound("selection");
        }}
      >
        <SelectTrigger id={id} className="options-settings-control py-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          onCloseAutoFocus={(event) => {
            if (!isFocusNavigationEnabled()) event.preventDefault();
          }}
        >
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.native ? <span lang={option.value}>{option.label}</span> : i18n.displayText(option.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SettingsSlider({
  icon: Icon,
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  useGameTranslation();
  return (
    <div className="options-settings-row">
      <p className={cn("options-settings-label options-settings-label-content", controlLabelClass)}>
        <SettingsIcon icon={Icon} />
        <span>{label}</span>
      </p>
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
        <p className="w-16 shrink-0 text-right text-lg font-semibold whitespace-nowrap text-primary tabular-nums">
          <GameMessage id="ui.settings-controls.s1" defaultValue="<part0/>%" parts={{ part0: value }} />
        </p>
      </div>
    </div>
  );
}

export function SettingsToggle({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  useGameTranslation();
  const id = useId();
  return (
    <div className="options-settings-row options-settings-toggle">
      <label
        htmlFor={id}
        className={cn("options-settings-label-content min-w-0 flex-1 cursor-pointer", controlLabelClass)}
      >
        <SettingsIcon icon={Icon} />
        <span>{label}</span>
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(next) => {
          onChange(next);
          if (next !== checked) playUISound(next ? "toggleOn" : "toggleOff");
        }}
      />
    </div>
  );
}
