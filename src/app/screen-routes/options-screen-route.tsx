import { useDeviceDisplayStore } from "@/features/alchemy/shared/stores/device-display-store";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { isDesktop } from "@/lib/platform";
import { OptionsScreen } from "@/features/alchemy/meta/screens";
import { useSettingsActions, useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import type { OptionsRouteCtx } from "./route-ctx";

type OptionsScreenRouteProps = OptionsRouteCtx;

const noop = (): void => {};

function OptionsScreenRoute({ onClearSaveData, onUnlockAllDevMode, onBack, onOpenGameMenu }: OptionsScreenRouteProps) {
  const settings = useSettingsStore(
    useShallow((s) => ({
      selectedAspectRatio: s.selectedAspectRatio,
      displayMode: s.displayMode,
      screenEffects: s.screenEffects,
      backgroundLights: s.backgroundLights,
      brightness: s.brightness,
      backgroundParticlesIntensity: s.backgroundParticlesIntensity,
      backgroundGlowIntensity: s.backgroundGlowIntensity,
      masterVolume: s.masterVolume,
      musicVolume: s.musicVolume,
      sfxVolume: s.sfxVolume,
      muteInBackground: s.muteInBackground,
      autoEndTurn: s.autoEndTurn,
      rememberAutoplayPreference: s.rememberAutoplayPreference,
    })),
  );
  const actions = useSettingsActions();
  const showClearSaveConfirm = useUiStore((s) => s.showClearSaveConfirm);
  const setShowClearSaveConfirm = useUiStore((s) => s.setShowClearSaveConfirm);
  const gameSizePercent = useDeviceDisplayStore((s) => s.gameSizePercent);
  const tooltipSizePercent = useDeviceDisplayStore((s) => s.tooltipSizePercent);
  const setGameSizePercent = useDeviceDisplayStore((s) => s.setGameSizePercent);
  const setTooltipSizePercent = useDeviceDisplayStore((s) => s.setTooltipSizePercent);
  const resetSizes = useDeviceDisplayStore((s) => s.resetSizes);

  return (
    <OptionsScreen
      // Options always has a back target (backFromOptions); the fallback only
      // satisfies the shared route ctx's optional onBack for type-level safety.
      onBack={onBack ?? noop}
      onMenu={onOpenGameMenu}
      display={{
        selectedAspectRatio: settings.selectedAspectRatio,
        onAspectRatioChange: actions.setSelectedAspectRatio,
        displayMode: settings.displayMode,
        onDisplayModeChange: actions.setDisplayMode,
        // Desktop-only control: displayMode still persists on web (harmless —
        // it applies if the save ever loads on desktop) but has no editor here.
        showDisplayMode: isDesktop(),
        screenEffects: settings.screenEffects,
        backgroundLights: settings.backgroundLights,
        onBackgroundLightsChange: actions.setBackgroundLights,
        onScreenEffectsChange: actions.setScreenEffects,
        brightness: settings.brightness,
        onBrightnessChange: actions.setBrightness,
        backgroundParticlesIntensity: settings.backgroundParticlesIntensity,
        onBackgroundParticlesIntensityChange: actions.setBackgroundParticlesIntensity,
        backgroundGlowIntensity: settings.backgroundGlowIntensity,
        onBackgroundGlowIntensityChange: actions.setBackgroundGlowIntensity,
      }}
      interface={{
        gameSizePercent,
        tooltipSizePercent,
        onGameSizeChange: setGameSizePercent,
        onTooltipSizeChange: setTooltipSizePercent,
      }}
      audio={{
        masterVolume: settings.masterVolume,
        musicVolume: settings.musicVolume,
        sfxVolume: settings.sfxVolume,
        onMasterVolumeChange: actions.setMasterVolume,
        onMusicVolumeChange: actions.setMusicVolume,
        onSfxVolumeChange: actions.setSfxVolume,
        muteInBackground: settings.muteInBackground,
        onMuteInBackgroundChange: actions.setMuteInBackground,
      }}
      gameplay={{
        autoEndTurn: settings.autoEndTurn,
        onAutoEndTurnChange: actions.setAutoEndTurn,
        rememberAutoplayPreference: settings.rememberAutoplayPreference,
        onRememberAutoplayPreferenceChange: actions.setRememberAutoplayPreference,
      }}
      saveData={{
        showClearSaveConfirm,
        onOpenClearSaveConfirm: () => setShowClearSaveConfirm(true),
        onCloseClearSaveConfirm: () => setShowClearSaveConfirm(false),
        onConfirmClearSave: onClearSaveData,
        onResetOptions: () => {
          // Reset Options restores every tunable (settings + device sizes).
          // Clear Save Data is the separate wipe path and intentionally leaves
          // device sizes alone (see clearAllPersistentGameData).
          actions.resetToDefaults();
          resetSizes();
        },
      }}
      dev={{ onUnlockAll: onUnlockAllDevMode }}
    />
  );
}

export const optionsScreenRoutes: {
  options: (ctx: OptionsRouteCtx) => ReactNode;
} = {
  options: (ctx) => <OptionsScreenRoute {...ctx} />,
};
