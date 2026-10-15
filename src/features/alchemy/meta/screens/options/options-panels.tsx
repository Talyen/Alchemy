import type { LanguagePreference } from "@/lib/localization/runtime";
import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText, displayText } from "@/lib/localization/runtime";

import { LANGUAGE_OPTIONS } from "@/lib/localization/language";
import { COMBATANT_FRAME_OPTIONS } from "../../../shared/config/combatant-frames";
import { useUiStore } from "../../../shared/stores/ui-store";
import { Button } from "@/components/ui/button";
import { displayModeOptions } from "@/features/alchemy/shared/config";
import { DEVICE_DISPLAY_RANGES, SETTINGS_RANGES } from "@/lib/settings-values";
import { SettingsSelect, SettingsSlider, SettingsToggle, SettingsSection, SettingsAction } from "./settings-controls";
import type { SettingsActions, SettingsSaveFields } from "../../../shared/stores/settings-store";

export interface DisplayOptionsProps {
  onOpenBoards?: (() => void) | undefined;
  languagePreference: LanguagePreference;
  onLanguageChange: (value: LanguagePreference) => void;
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
  useGameTranslation();
  const { values, actions } = preferences;
  return (
    <div className="space-y-4">
      <SettingsSection title={gameText("ui.options-panels.1", "Display")}>
        {import.meta.env.DEV && display.languagePreference === "zh-Hans" ? (
          <p lang="zh-Hans" data-chinese-font-sample>
            {"简体中文字体测试：造成 12 点伤害，获得 5 点格挡。"}
          </p>
        ) : null}
        <SettingsSelect
          id="language"
          label={gameText("options.language-choice", "Language")}
          value={display.languagePreference}
          options={LANGUAGE_OPTIONS}
          onChange={display.onLanguageChange}
        />
        {display.onOpenBoards ? (
          <SettingsAction
            label={gameText("ui.options-panels.2", "Game Boards")}
            description={gameText("ui.options-panels.3", "Battle background artwork")}
          >
            <Button onClick={display.onOpenBoards}>{gameText("ui.options-panels.4", "Browse Boards")}</Button>
          </SettingsAction>
        ) : null}
        {display.showDisplayMode ? (
          <SettingsSelect
            id="display-mode"
            label={gameText("ui.options-panels.5", "Display Mode")}
            value={values.displayMode}
            options={displayModeOptions}
            onChange={actions.setDisplayMode}
          />
        ) : null}
        <SettingsSlider
          label={gameText("ui.options-panels.6", "Brightness")}
          value={values.brightness}
          onChange={actions.setBrightness}
          min={SETTINGS_RANGES.brightness.min}
          max={SETTINGS_RANGES.brightness.max}
        />
        <SettingsSlider
          label={gameText("ui.options-panels.7", "Game Size")}
          value={display.gameSizePercent}
          onChange={display.onGameSizeChange}
          {...DEVICE_DISPLAY_RANGES.gameSizePercent}
        />
        <SettingsSlider
          label={gameText("ui.options-panels.8", "Tooltip Size")}
          value={display.tooltipSizePercent}
          onChange={display.onTooltipSizeChange}
          {...DEVICE_DISPLAY_RANGES.tooltipSizePercent}
        />
      </SettingsSection>
      <SettingsSection title={gameText("ui.options-panels.9", "Background")}>
        <SettingsSlider
          label={gameText("ui.options-panels.10", "Background Glow")}
          value={values.backgroundGlowIntensity}
          onChange={actions.setBackgroundGlowIntensity}
          {...SETTINGS_RANGES.specialEffects}
        />
        <SettingsSlider
          label={gameText("ui.options-panels.11", "Background Particles")}
          value={values.backgroundParticlesIntensity}
          onChange={actions.setBackgroundParticlesIntensity}
          {...SETTINGS_RANGES.specialEffects}
        />
      </SettingsSection>
    </div>
  );
}

export function AudioOptionsPanel({ preferences }: { preferences: OptionsPreferences }) {
  useGameTranslation();
  const { values, actions } = preferences;
  return (
    <SettingsSection title={gameText("ui.options-panels.12", "Audio")}>
      {(
        [
          ["Overall Volume", values.masterVolume, actions.setMasterVolume],
          ["Music Volume", values.musicVolume, actions.setMusicVolume],
          ["Sound Effects Volume", values.sfxVolume, actions.setSfxVolume],
        ] as const
      ).map(([label, value, onChange]) => (
        <SettingsSlider
          key={label}
          label={displayText(label)}
          value={value}
          onChange={onChange}
          {...SETTINGS_RANGES.volume}
        />
      ))}
      <SettingsToggle
        label={gameText("ui.options-panels.13", "Boss Lyrics")}
        checked={values.bossLyricsEnabled}
        onChange={actions.setBossLyricsEnabled}
      />
      <SettingsToggle
        label={gameText("ui.options-panels.14", "Mute in Background")}
        checked={values.muteInBackground}
        onChange={actions.setMuteInBackground}
      />
    </SettingsSection>
  );
}

export function GameplayOptionsPanel({ preferences }: { preferences: OptionsPreferences }) {
  useGameTranslation();
  const { values, actions } = preferences;
  return (
    <SettingsSection title={gameText("ui.options-panels.15", "Battle")}>
      <SettingsToggle
        label={gameText("ui.options-panels.16", "Auto-End Turn")}
        checked={values.autoEndTurn}
        onChange={actions.setAutoEndTurn}
      />
      <SettingsToggle
        label={gameText("ui.options-panels.17", "Remember Auto-Battle Preference")}
        checked={values.rememberAutoplayPreference}
        onChange={actions.setRememberAutoplayPreference}
      />
    </SettingsSection>
  );
}

function SaveDataOptionsPanel({ saveData }: { saveData: SaveDataOptionsProps }) {
  useGameTranslation();
  return (
    <SettingsSection title={gameText("ui.options-panels.18", "Reset & Save Data")}>
      <SettingsAction
        label={gameText("ui.options-panels.19", "Options")}
        description={gameText("ui.options-panels.20", "Reset all options to default values")}
      >
        <Button variant="outline" onClick={saveData.onResetOptions}>
          {gameText("ui.options-panels.21", "Reset to Default")}
        </Button>
      </SettingsAction>
      <SettingsAction
        label={gameText("ui.options-panels.22", "Save Data")}
        description={gameText("ui.options-panels.23", "Clear all existing save data and start fresh")}
      >
        <Button variant="destructive" onClick={saveData.onOpenClearSaveConfirm}>
          {gameText("ui.options-panels.24", "Clear Save Data")}
        </Button>
      </SettingsAction>
    </SettingsSection>
  );
}

function DevOptionsPanel({ dev }: { dev: DevOptionsProps }) {
  useGameTranslation();
  const frameStyle = useUiStore((state) => state.combatantFrameStyle);
  const setFrameStyle = useUiStore((state) => state.setCombatantFrameStyle);
  if (!import.meta.env.DEV) return null;
  return (
    <SettingsSection title={gameText("ui.options-panels.25", "Dev Only")}>
      <SettingsSelect
        id="combatant-frame-style"
        label={gameText("ui.options-panels.26", "Combatant Frames")}
        value={frameStyle}
        options={COMBATANT_FRAME_OPTIONS}
        onChange={setFrameStyle}
      />
      <SettingsAction
        label={gameText("ui.options-panels.27", "Dev / QA Unlocks")}
        description={gameText(
          "ui.options-panels.28",
          "Unlock every collection entry and grant every talent node for testing",
        )}
      >
        <Button onClick={dev.onUnlockAll}>{gameText("ui.options-panels.29", "Unlock All")}</Button>
      </SettingsAction>
      {dev.onOpenErrorLog ? (
        <SettingsAction
          label={gameText("ui.options-panels.30", "Error Log")}
          description={gameText("ui.options-panels.31", "Inspect errors logged during this session for bug reports")}
        >
          <Button variant="outline" onClick={dev.onOpenErrorLog}>
            {gameText("ui.options-panels.32", "View Log")}
          </Button>
        </SettingsAction>
      ) : null}
    </SettingsSection>
  );
}

export function OtherOptionsPanel({ saveData, dev }: { saveData: SaveDataOptionsProps; dev: DevOptionsProps }) {
  useGameTranslation();
  return (
    <div className="space-y-4">
      <SaveDataOptionsPanel saveData={saveData} />
      <DevOptionsPanel dev={dev} />
    </div>
  );
}
