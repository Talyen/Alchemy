import { Button } from "@/components/ui/button";
import {
  aspectRatioOptions,
  controlDescriptionClass,
  controlLabelClass,
  displayModeOptions,
  settingsPanelShellClass,
} from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import { SETTINGS_RANGES } from "@/lib/settings-values";
import { AspectRatioSelect, DisplayModeSelect, SettingsSlider, SettingsToggle } from "../../shared/ui/shared-ui";
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
      <SettingsSlider
        label="Brightness"
        value={display.brightness}
        onChange={display.onBrightnessChange}
        min={SETTINGS_RANGES.brightness.min}
        max={SETTINGS_RANGES.brightness.max}
      />
    </div>
  );
}

export function AudioOptionsPanel({ audio }: { audio: AudioOptionsProps }) {
  return (
    <div className="space-y-4">
      <SettingsSlider label="Master Volume" value={audio.masterVolume} onChange={audio.onMasterVolChange} />
      <SettingsSlider label="Music Volume" value={audio.musicVolume} onChange={audio.onMusicVolChange} />
      <SettingsSlider label="Sound Effects Volume" value={audio.sfxVolume} onChange={audio.onSfxVolChange} />
      <SettingsToggle
        label="Mute in Background"
        checked={audio.muteInBackground}
        onChange={audio.onMuteInBackgroundChange}
      />
    </div>
  );
}

export function GameplayOptionsPanel({ gameplay }: { gameplay: GameplayOptionsProps }) {
  return (
    <div className="space-y-4">
      <SettingsToggle label="Auto-End Turn" checked={gameplay.autoEndTurn} onChange={gameplay.onAutoEndTurnChange} />
      <SettingsToggle
        label="Remember Auto-Battle Preference"
        checked={gameplay.rememberAutoplayPreference}
        onChange={gameplay.onRememberAutoplayPreferenceChange}
      />
    </div>
  );
}

export function SaveDataOptionsPanel({ saveData }: { saveData: SaveDataOptionsProps }) {
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
    </div>
  );
}

export function DevOptionsPanel({ dev }: { dev: DevOptionsProps }) {
  if (!import.meta.env.DEV) return null;
  return (
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
  );
}

export function OtherOptionsPanel({ saveData, dev }: { saveData: SaveDataOptionsProps; dev: DevOptionsProps }) {
  return (
    <div className="space-y-4">
      <SaveDataOptionsPanel saveData={saveData} />
      <DevOptionsPanel dev={dev} />
    </div>
  );
}
