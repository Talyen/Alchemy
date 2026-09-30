import { Button } from "@/components/ui/button";
import { aspectRatioOptions, displayModeOptions } from "@/features/alchemy/shared/config";
import { DEVICE_DISPLAY_RANGES, SETTINGS_RANGES } from "@/lib/settings-values";
import {
  AspectRatioSelect,
  DisplayModeSelect,
  SettingsSlider,
  SettingsToggle,
  SettingsSection,
  SettingsAction,
} from "./settings-controls";
import type { AspectRatioOption, DisplayMode } from "../../../shared/types";

export interface DisplayOptionsProps {
  selectedAspectRatio: AspectRatioOption;
  onAspectRatioChange: (aspectRatio: AspectRatioOption) => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  showDisplayMode: boolean;
  brightness: number;
  onBrightnessChange: (value: number) => void;
  backgroundParticlesIntensity: number;
  onBackgroundParticlesIntensityChange: (value: number) => void;
  backgroundGlowIntensity: number;
  onBackgroundGlowIntensityChange: (value: number) => void;
  gameSizePercent: number;
  tooltipSizePercent: number;
  onGameSizeChange: (value: number) => void;
  onTooltipSizeChange: (value: number) => void;
}

export interface AudioOptionsProps {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  onMasterVolumeChange: (value: number) => void;
  onMusicVolumeChange: (value: number) => void;
  onSfxVolumeChange: (value: number) => void;
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
  onUnlockAll: () => void;
  onOpenErrorLog?: () => void;
}

export function DisplayOptionsPanel({ display }: { display: DisplayOptionsProps }) {
  return (
    <div className="space-y-4">
      <SettingsSection title="Display">
        {display.showDisplayMode ? (
          <DisplayModeSelect
            displayMode={display.displayMode}
            displayModeOptions={displayModeOptions}
            onChange={display.onDisplayModeChange}
          />
        ) : null}
        <AspectRatioSelect
          selectedAspectRatio={display.selectedAspectRatio}
          aspectRatioOptions={aspectRatioOptions}
          onChange={display.onAspectRatioChange}
        />
        <SettingsSlider
          label="Brightness"
          value={display.brightness}
          onChange={display.onBrightnessChange}
          min={SETTINGS_RANGES.brightness.min}
          max={SETTINGS_RANGES.brightness.max}
        />
        <SettingsSlider
          label="Game Size"
          value={display.gameSizePercent}
          onChange={display.onGameSizeChange}
          {...DEVICE_DISPLAY_RANGES.gameSizePercent}
        />
        <SettingsSlider
          label="Tooltip Size"
          value={display.tooltipSizePercent}
          onChange={display.onTooltipSizeChange}
          {...DEVICE_DISPLAY_RANGES.tooltipSizePercent}
        />
      </SettingsSection>
      <SettingsSection title="Background">
        <SettingsSlider
          label="Background Glow"
          value={display.backgroundGlowIntensity}
          onChange={display.onBackgroundGlowIntensityChange}
          {...SETTINGS_RANGES.specialEffects}
        />
        <SettingsSlider
          label="Background Particles"
          value={display.backgroundParticlesIntensity}
          onChange={display.onBackgroundParticlesIntensityChange}
          {...SETTINGS_RANGES.specialEffects}
        />
      </SettingsSection>
    </div>
  );
}

export function AudioOptionsPanel({ audio }: { audio: AudioOptionsProps }) {
  return (
    <SettingsSection>
      <SettingsSlider
        label="Overall Volume"
        value={audio.masterVolume}
        onChange={audio.onMasterVolumeChange}
        min={SETTINGS_RANGES.volume.min}
        max={SETTINGS_RANGES.volume.max}
      />
      <SettingsSlider
        label="Music Volume"
        value={audio.musicVolume}
        onChange={audio.onMusicVolumeChange}
        min={SETTINGS_RANGES.volume.min}
        max={SETTINGS_RANGES.volume.max}
      />
      <SettingsSlider
        label="Sound Effects Volume"
        value={audio.sfxVolume}
        onChange={audio.onSfxVolumeChange}
        min={SETTINGS_RANGES.volume.min}
        max={SETTINGS_RANGES.volume.max}
      />
      <SettingsToggle
        label="Mute in Background"
        checked={audio.muteInBackground}
        onChange={audio.onMuteInBackgroundChange}
      />
    </SettingsSection>
  );
}

export function GameplayOptionsPanel({ gameplay }: { gameplay: GameplayOptionsProps }) {
  return (
    <SettingsSection>
      <SettingsToggle label="Auto-End Turn" checked={gameplay.autoEndTurn} onChange={gameplay.onAutoEndTurnChange} />
      <SettingsToggle
        label="Remember Auto-Battle Preference"
        checked={gameplay.rememberAutoplayPreference}
        onChange={gameplay.onRememberAutoplayPreferenceChange}
      />
    </SettingsSection>
  );
}

function SaveDataOptionsPanel({ saveData }: { saveData: SaveDataOptionsProps }) {
  return (
    <SettingsSection>
      <SettingsAction label="Options" description="Reset all options to default values">
        <Button variant="outline" onClick={saveData.onResetOptions}>
          Reset to Default
        </Button>
      </SettingsAction>
      <SettingsAction label="Save Data" description="Clear all existing save data and start fresh">
        <Button variant="destructive" onClick={saveData.onOpenClearSaveConfirm}>
          Clear Save Data
        </Button>
      </SettingsAction>
    </SettingsSection>
  );
}

function DevOptionsPanel({ dev }: { dev: DevOptionsProps }) {
  if (!import.meta.env.DEV) return null;
  return (
    <SettingsSection title="Dev Only">
      <SettingsAction
        label="Dev / QA Unlocks"
        description="Unlock every collection entry and grant every talent node for testing"
      >
        <Button onClick={dev.onUnlockAll}>Unlock All</Button>
      </SettingsAction>
      {dev.onOpenErrorLog ? (
        <SettingsAction label="Error Log" description="Inspect errors logged during this session for bug reports">
          <Button variant="outline" onClick={dev.onOpenErrorLog}>
            View Log
          </Button>
        </SettingsAction>
      ) : null}
    </SettingsSection>
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
