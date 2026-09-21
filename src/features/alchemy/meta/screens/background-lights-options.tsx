import type { BackgroundLightsSettings } from "@/lib/screen-effect-settings";
import { SettingsReveal, SettingsSelect, SettingsSlider, SettingsToggle } from "./settings-controls";
export function BackgroundLightsOptions({
  settings,
  onChange,
}: {
  settings: BackgroundLightsSettings;
  onChange: (patch: Partial<BackgroundLightsSettings>) => void;
}) {
  return (
    <div>
      <SettingsToggle
        label="Drifting Lights"
        checked={settings.enabled}
        onChange={(enabled) => onChange({ enabled })}
      />
      <SettingsReveal open={settings.enabled}>
        <SettingsSlider
          label="Light Intensity"
          value={settings.strength}
          onChange={(strength) => onChange({ strength })}
        />
        <SettingsSelect
          id="screen-light-motion"
          label="Light Motion"
          value={settings.motion}
          options={[
            { value: "still", label: "Still" },
            { value: "slow", label: "Slow" },
            { value: "flowing", label: "Flowing" },
          ]}
          onChange={(motion) => onChange({ motion })}
        />
      </SettingsReveal>
    </div>
  );
}
