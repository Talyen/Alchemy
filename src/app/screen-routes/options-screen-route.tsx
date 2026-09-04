import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { isDesktop } from "@/lib/platform";
import { OptionsScreen } from "@/features/alchemy/meta/screens";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useSettingsActions } from "@/features/alchemy/shared/stores/store-actions";
import type { OptionsRouteCtx } from "./route-ctx";

type OptionsScreenRouteProps = OptionsRouteCtx;

function OptionsScreenRoute({
  onClearSaveData,
  onUnlockAllDevMode,
  onBackFromOptions,
  onOpenGameMenu,
}: OptionsScreenRouteProps) {
  const settings = useSettingsStore(
    useShallow((s) => ({
      selectedAspectRatio: s.selectedAspectRatio,
      displayMode: s.displayMode,
      brightness: s.brightness,
      backgroundParticlesIntensity: s.backgroundParticlesIntensity,
      backgroundGlowIntensity: s.backgroundGlowIntensity,
      masterVolume: s.masterVolume,
      musicVolume: s.musicVolume,
      sfxVolume: s.sfxVolume,
      muteInBackground: s.muteInBackground,
      autoEndTurn: s.autoEndTurn,
      rememberAutoplayPreference: s.rememberAutoplayPreference,
      showClearSaveConfirm: s.showClearSaveConfirm,
    })),
  );
  const actions = useSettingsActions();

  return (
    <OptionsScreen
      onBack={onBackFromOptions}
      onMenu={onOpenGameMenu}
      display={{
        selectedAspectRatio: settings.selectedAspectRatio,
        onAspectRatioChange: actions.setSelectedAspectRatio,
        displayMode: settings.displayMode,
        onDisplayModeChange: actions.setDisplayMode,
        showDisplayMode: isDesktop(),
        brightness: settings.brightness,
        onBrightnessChange: actions.setBrightness,
        backgroundParticlesIntensity: settings.backgroundParticlesIntensity,
        onBackgroundParticlesIntensityChange: actions.setBackgroundParticlesIntensity,
        backgroundGlowIntensity: settings.backgroundGlowIntensity,
        onBackgroundGlowIntensityChange: actions.setBackgroundGlowIntensity,
      }}
      audio={{
        masterVolume: settings.masterVolume,
        musicVolume: settings.musicVolume,
        sfxVolume: settings.sfxVolume,
        onMasterVolChange: actions.setMasterVolume,
        onMusicVolChange: actions.setMusicVolume,
        onSfxVolChange: actions.setSfxVolume,
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
        showClearSaveConfirm: settings.showClearSaveConfirm,
        onOpenClearSaveConfirm: () => actions.setShowClearSaveConfirm(true),
        onCloseClearSaveConfirm: () => actions.setShowClearSaveConfirm(false),
        onConfirmClearSave: onClearSaveData,
        onResetOptions: actions.resetToDefaults,
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
