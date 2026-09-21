import type { ScreenEffectsSettings } from "@/lib/screen-effect-settings";
import { createDefaultScreenEffects } from "@/lib/screen-effect-settings";
import { Button } from "@/components/ui/button";
import { SettingsReveal, SettingsSelect, SettingsSlider, SettingsToggle } from "./settings-controls";

export function ScreenEffectsOptions({
  settings,
  onChange,
}: {
  settings: ScreenEffectsSettings;
  onChange: (patch: Partial<ScreenEffectsSettings>) => void;
}) {
  return (
    <div>
      <SettingsToggle label="Screen Effects" checked={settings.enabled} onChange={(enabled) => onChange({ enabled })} />
      <SettingsReveal open={settings.enabled}>
        <div className="space-y-4 border-l border-primary/20 pl-4">
          <div>
            <SettingsToggle
              label="Scanlines"
              checked={settings.scanlines.enabled}
              onChange={(enabled) => onChange({ scanlines: { ...settings.scanlines, enabled } })}
            />
            <SettingsReveal open={settings.scanlines.enabled}>
              <SettingsSlider
                label="Scanline Strength"
                value={settings.scanlines.strength}
                onChange={(strength) => onChange({ scanlines: { ...settings.scanlines, strength } })}
              />
              <SettingsSelect
                id="scanline-spacing"
                label="Scanline Spacing"
                value={settings.scanlines.spacing}
                options={[
                  { value: "fine", label: "Fine" },
                  { value: "normal", label: "Normal" },
                  { value: "wide", label: "Wide" },
                ]}
                onChange={(spacing) => onChange({ scanlines: { ...settings.scanlines, spacing } })}
              />
            </SettingsReveal>
          </div>
          <div>
            <SettingsToggle
              label="Color Tint"
              checked={settings.tint.enabled}
              onChange={(enabled) => onChange({ tint: { ...settings.tint, enabled } })}
            />
            <SettingsReveal open={settings.tint.enabled}>
              <SettingsSelect
                id="screen-tint-color"
                label="Tint Color"
                value={settings.tint.color}
                options={[
                  { value: "green", label: "Green" },
                  { value: "amber", label: "Amber" },
                  { value: "cool", label: "Cool Blue" },
                ]}
                onChange={(color) => onChange({ tint: { ...settings.tint, color } })}
              />
              <SettingsSlider
                label="Tint Strength"
                value={settings.tint.strength}
                onChange={(strength) => onChange({ tint: { ...settings.tint, strength } })}
              />
            </SettingsReveal>
          </div>
          <div>
            <SettingsToggle
              label="Darkened Edges"
              checked={settings.edges.enabled}
              onChange={(enabled) => onChange({ edges: { ...settings.edges, enabled } })}
            />
            <SettingsReveal open={settings.edges.enabled}>
              <SettingsSlider
                label="Edge Shading Strength"
                value={settings.edges.strength}
                onChange={(strength) => onChange({ edges: { ...settings.edges, strength } })}
              />
            </SettingsReveal>
          </div>
          <div>
            <SettingsToggle
              label="Paper Grain"
              checked={settings.grain.enabled}
              onChange={(enabled) => onChange({ grain: { ...settings.grain, enabled } })}
            />
            <SettingsReveal open={settings.grain.enabled}>
              <SettingsSlider
                label="Grain Strength"
                value={settings.grain.strength}
                onChange={(strength) => onChange({ grain: { ...settings.grain, strength } })}
              />
            </SettingsReveal>
          </div>
          <Button variant="outline" onClick={() => onChange(createDefaultScreenEffects())}>
            Reset Screen Effects
          </Button>
        </div>
      </SettingsReveal>
    </div>
  );
}
