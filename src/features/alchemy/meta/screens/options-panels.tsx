import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  aspectRatioOptions,
  controlDescriptionClass,
  controlLabelClass,
  displayModeOptions,
  settingsPanelShellClass,
} from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import { AspectRatioSelect, DisplayModeSelect } from "../../shared/ui/shared-ui";
import type { AspectRatioOption, DisplayMode } from "../../shared/types";

export interface DisplayOptionsProps {
  selectedAspectRatio: AspectRatioOption;
  onAspectRatioChange: (aspectRatio: AspectRatioOption) => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  showDisplayMode: boolean;
  brightness: number;
  onBrightnessChange: (value: number) => void;
}

export interface AudioOptionsProps {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  onMasterVolChange: (value: number) => void;
  onMusicVolChange: (value: number) => void;
  onSfxVolChange: (value: number) => void;
  muteInBackground: boolean;
  onMuteInBackgroundChange: (checked: boolean) => void;
}

export interface GameplayOptionsProps {
  autoEndTurn: boolean;
  onAutoEndTurnChange: (checked: boolean) => void;
  rememberAutoplayPreference: boolean;
  onRememberAutoplayPreferenceChange: (checked: boolean) => void;
}

export interface SaveDataOptionsProps {
  showClearSaveConfirm: boolean;
  onOpenClearSaveConfirm: () => void;
  onCloseClearSaveConfirm: () => void;
  onConfirmClearSave: () => void;
  onResetOptions: () => void;
}

export interface DevOptionsProps {
  onClearSave?: () => void;
  onUnlockAll: () => void;
  onOpenErrorLog?: () => void;
}

// Keeps slider rows consistent so volume settings read as one sound board.
function SliderOption({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
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
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="mt-3 w-full accent-primary"
      />
    </div>
  );
}

// Toggle row with a native switch role for boolean options.
function ToggleOption({
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

// Display options stay together because these controls all affect the rendered game stage.
export function DisplayOptionsPanel({ display }: { display: DisplayOptionsProps }) {
  return (
    <div className="space-y-4">
      <AspectRatioSelect
        selectedAspectRatio={display.selectedAspectRatio}
        aspectRatioOptions={aspectRatioOptions}
        onChange={display.onAspectRatioChange}
      />
      {display.showDisplayMode ? (
        <DisplayModeSelect
          displayMode={display.displayMode}
          displayModeOptions={displayModeOptions}
          onChange={display.onDisplayModeChange}
        />
      ) : null}
      <SliderOption
        label="Brightness"
        value={display.brightness}
        onChange={display.onBrightnessChange}
        min={50}
        max={150}
      />
    </div>
  );
}

// Audio controls share the same slider/toggle visual language for quick scanning.
export function AudioOptionsPanel({ audio }: { audio: AudioOptionsProps }) {
  return (
    <div className="space-y-4">
      <SliderOption label="Master Volume" value={audio.masterVolume} onChange={audio.onMasterVolChange} />
      <SliderOption label="Music Volume" value={audio.musicVolume} onChange={audio.onMusicVolChange} />
      <SliderOption label="Sound Effects Volume" value={audio.sfxVolume} onChange={audio.onSfxVolChange} />
      <ToggleOption
        label="Mute in Background"
        checked={audio.muteInBackground}
        onChange={audio.onMuteInBackgroundChange}
      />
    </div>
  );
}

// Gameplay options are separated from save/dev actions so future combat preferences have a clear home.
export function GameplayOptionsPanel({ gameplay }: { gameplay: GameplayOptionsProps }) {
  return (
    <div className="space-y-4">
      <ToggleOption label="Auto-End Turn" checked={gameplay.autoEndTurn} onChange={gameplay.onAutoEndTurnChange} />
      <ToggleOption
        label="Remember Auto-Battle Preference"
        checked={gameplay.rememberAutoplayPreference}
        onChange={gameplay.onRememberAutoplayPreferenceChange}
      />
    </div>
  );
}

// Destructive save actions and dev unlocks live in the secondary tab to avoid crowding core settings.
export function OtherOptionsPanel({ saveData, dev }: { saveData: SaveDataOptionsProps; dev: DevOptionsProps }) {
  return (
    <div className="space-y-4">
      <div className={settingsPanelShellClass}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className={controlLabelClass}>Options</p>
            <p className={controlDescriptionClass}>Restore display, sound, and gameplay options to their defaults.</p>
          </div>
          <Button size="lg" variant="outline" onClick={saveData.onResetOptions}>
            Reset to Default
          </Button>
        </div>
      </div>
      <div className={settingsPanelShellClass}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className={controlLabelClass}>Save Data</p>
            <p className={controlDescriptionClass}>Clear all existing save data and start fresh.</p>
          </div>
          <Button size="lg" variant="destructive" onClick={saveData.onOpenClearSaveConfirm}>
            Clear Save Data
          </Button>
        </div>
      </div>
      {import.meta.env.DEV ? (
        <section className="rounded-shell-panel border border-primary/40 p-5 surface-muted">
          <p className={cn(controlLabelClass, "mb-4")}>Dev Only</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={controlLabelClass}>Dev / QA Unlocks</p>
                <p className={controlDescriptionClass}>
                  Unlock every compendium entry and grant every talent node for testing.
                </p>
              </div>
              <Button size="lg" onClick={dev.onUnlockAll}>
                Unlock All
              </Button>
            </div>
            {dev.onOpenErrorLog ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={controlLabelClass}>Error Log</p>
                  <p className={controlDescriptionClass}>Inspect errors logged during this session for bug reports.</p>
                </div>
                <Button size="lg" variant="outline" onClick={dev.onOpenErrorLog}>
                  View Log
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
