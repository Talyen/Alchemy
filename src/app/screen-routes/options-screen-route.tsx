/* eslint-disable react-refresh/only-export-components -- route mapping table colocated here */
import type { ReactNode } from "react";
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
      masterVol: s.masterVol,
      musicVol: s.musicVol,
      sfxVol: s.sfxVol,
      muteInBackground: s.muteInBackground,
      autoEndTurn: s.autoEndTurn,
      showClearSaveConfirm: s.showClearSaveConfirm,
    })),
  );
  const actions = useSettingsActions();

  return (
    <OptionsScreen
      onOpenMenu={onOpenBattleMenu}
      onBack={onBackFromOptions}
      display={{
        selectedAspectRatio: settings.selectedAspectRatio,
        onAspectRatioChange: actions.setSelectedAspectRatio,
        displayMode: settings.displayMode,
        onDisplayModeChange: actions.setDisplayMode,
        showDisplayMode: isDesktop(),
        brightness: settings.brightness,
        onBrightnessChange: actions.setBrightness,
      }}
      audio={{
        masterVol: settings.masterVol,
        musicVol: settings.musicVol,
        sfxVol: settings.sfxVol,
        onMasterVolChange: actions.setMasterVol,
        onMusicVolChange: actions.setMusicVol,
        onSfxVolChange: actions.setSfxVol,
        muteInBackground: settings.muteInBackground,
        onMuteInBackgroundChange: actions.setMuteInBackground,
      }}
      gameplay={{ autoEndTurn: settings.autoEndTurn, onAutoEndTurnChange: actions.setAutoEndTurn }}
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
