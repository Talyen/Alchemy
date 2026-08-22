/* eslint-disable react-refresh/only-export-components -- route mapping table colocated here */
import { useMemo, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { isDesktop } from "@/lib/platform";
import { OptionsScreen } from "@/features/alchemy/meta/screens";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useSettingsActions } from "@/features/alchemy/shared/stores/store-actions";
import type { OptionsRouteCtx } from "./route-ctx";

type OptionsScreenRouteProps = OptionsRouteCtx;

function OptionsScreenRoute({
  onOpenBattleMenu,
  onClearSaveData,
  onUnlockAllDevMode,
  onBackFromOptions,
}: OptionsScreenRouteProps) {
  const settings = useSettingsStore(
    useShallow((s) => ({
      selectedAspectRatio: s.selectedAspectRatio,
      displayMode: s.displayMode,
      brightness: s.brightness,
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

  const displayProps = useMemo(
    () => ({
      selectedAspectRatio: settings.selectedAspectRatio,
      onAspectRatioChange: actions.setSelectedAspectRatio,
      displayMode: settings.displayMode,
      onDisplayModeChange: actions.setDisplayMode,
      showDisplayMode: isDesktop(),
      brightness: settings.brightness,
      onBrightnessChange: actions.setBrightness,
    }),
    [settings.selectedAspectRatio, settings.displayMode, settings.brightness, actions],
  );

  const audioProps = useMemo(
    () => ({
      masterVolume: settings.masterVolume,
      musicVolume: settings.musicVolume,
      sfxVolume: settings.sfxVolume,
      onMasterVolChange: actions.setMasterVolume,
      onMusicVolChange: actions.setMusicVolume,
      onSfxVolChange: actions.setSfxVolume,
      muteInBackground: settings.muteInBackground,
      onMuteInBackgroundChange: actions.setMuteInBackground,
    }),
    [settings.masterVolume, settings.musicVolume, settings.sfxVolume, settings.muteInBackground, actions],
  );

  const gameplayProps = useMemo(
    () => ({
      autoEndTurn: settings.autoEndTurn,
      onAutoEndTurnChange: actions.setAutoEndTurn,
      rememberAutoplayPreference: settings.rememberAutoplayPreference,
      onRememberAutoplayPreferenceChange: actions.setRememberAutoplayPreference,
    }),
    [settings.autoEndTurn, settings.rememberAutoplayPreference, actions],
  );

  const saveDataProps = useMemo(
    () => ({
      showClearSaveConfirm: settings.showClearSaveConfirm,
      onOpenClearSaveConfirm: () => actions.setShowClearSaveConfirm(true),
      onCloseClearSaveConfirm: () => actions.setShowClearSaveConfirm(false),
      onConfirmClearSave: onClearSaveData,
      onResetOptions: actions.resetToDefaults,
    }),
    [settings.showClearSaveConfirm, actions, onClearSaveData],
  );

  const devProps = useMemo(() => ({ onUnlockAll: onUnlockAllDevMode }), [onUnlockAllDevMode]);

  return (
    <OptionsScreen
      onOpenMenu={onOpenBattleMenu}
      onBack={onBackFromOptions}
      display={displayProps}
      audio={audioProps}
      gameplay={gameplayProps}
      saveData={saveDataProps}
      dev={devProps}
    />
  );
}

export const optionsScreenRoutes: {
  options: (ctx: OptionsRouteCtx) => ReactNode;
} = {
  options: (ctx) => <OptionsScreenRoute {...ctx} />,
};
