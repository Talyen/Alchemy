import { COMBATANT_FRAME_OPTIONS } from "../../../shared/config/combatant-frames";
import { useUiStore } from "../../../shared/stores/ui-store";
import { Button } from "@/components/ui/button";
import { displayModeOptions } from "@/features/alchemy/shared/config";
import { DEVICE_DISPLAY_RANGES, SETTINGS_RANGES } from "@/lib/settings-values";
import { SettingsSelect, SettingsSlider, SettingsToggle, SettingsSection, SettingsAction } from "./settings-controls";
import type { SettingsActions, SettingsSaveFields } from "../../../shared/stores/settings-store";

export interface DisplayOptionsProps {
  onOpenBoards?: (() => void) | undefined;
  showDisplayMode: boolean;
  gameSizePercent: number;
  tooltipSizePercent: number;
  onGameSizeChange: (value: number) => void;
  onTooltipSizeChange: (value: number) => void;
}

export interface OptionsPreferences {
  values: SettingsSaveFields;
  actions: SettingsActions;
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

export function DisplayOptionsPanel({
  display,
  preferences,
}: {
  display: DisplayOptionsProps;
  preferences: OptionsPreferences;
}) {
  const { values, actions } = preferences;
  return (
    <div className="space-y-4">
      <SettingsSection title="Display">
        {display.onOpenBoards ? (
          <SettingsAction label="Game Boards" description="Battle background artwork">
            <Button onClick={display.onOpenBoards}>Browse Boards</Button>
          </SettingsAction>
        ) : null}
        {display.showDisplayMode ? (
          <SettingsSelect
            id="display-mode"
            label="Display Mode"
            value={values.displayMode}
            options={displayModeOptions}
            onChange={actions.setDisplayMode}
          />
        ) : null}
        <SettingsSlider
          label="Brightness"
          value={values.brightness}
          onChange={actions.setBrightness}
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
          value={values.backgroundGlowIntensity}
          onChange={actions.setBackgroundGlowIntensity}
          {...SETTINGS_RANGES.specialEffects}
        />
        <SettingsSlider
          label="Background Particles"
          value={values.backgroundParticlesIntensity}
          onChange={actions.setBackgroundParticlesIntensity}
          {...SETTINGS_RANGES.specialEffects}
        />
      </SettingsSection>
    </div>
  );
}

export function AudioOptionsPanel({ preferences }: { preferences: OptionsPreferences }) {
  const { values, actions } = preferences;
  return (
    <SettingsSection title="Audio">
      {(
        [
          ["Overall Volume", values.masterVolume, actions.setMasterVolume],
          ["Music Volume", values.musicVolume, actions.setMusicVolume],
          ["Sound Effects Volume", values.sfxVolume, actions.setSfxVolume],
        ] as const
      ).map(([label, value, onChange]) => (
        <SettingsSlider key={label} label={label} value={value} onChange={onChange} {...SETTINGS_RANGES.volume} />
      ))}
      <SettingsToggle label="Boss Lyrics" checked={values.bossLyricsEnabled} onChange={actions.setBossLyricsEnabled} />
      <SettingsToggle
        label="Mute in Background"
        checked={values.muteInBackground}
        onChange={actions.setMuteInBackground}
      />
    </SettingsSection>
  );
}

export function GameplayOptionsPanel({ preferences }: { preferences: OptionsPreferences }) {
  const { values, actions } = preferences;
  return (
    <SettingsSection title="Battle">
      <SettingsToggle label="Auto-End Turn" checked={values.autoEndTurn} onChange={actions.setAutoEndTurn} />
      <SettingsToggle
        label="Remember Auto-Battle Preference"
        checked={values.rememberAutoplayPreference}
        onChange={actions.setRememberAutoplayPreference}
      />
    </SettingsSection>
  );
}

function SaveDataOptionsPanel({ saveData }: { saveData: SaveDataOptionsProps }) {
  return (
    <SettingsSection title="Reset & Save Data">
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
  const frameStyle = useUiStore((state) => state.combatantFrameStyle);
  const setFrameStyle = useUiStore((state) => state.setCombatantFrameStyle);
  if (!import.meta.env.DEV) return null;
  return (
    <SettingsSection title="Dev Only">
      <SettingsSelect
        id="combatant-frame-style"
        label="Combatant Frames"
        value={frameStyle}
        options={COMBATANT_FRAME_OPTIONS}
        onChange={setFrameStyle}
      />
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
