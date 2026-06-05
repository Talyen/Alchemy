import { platform } from "@/lib/platform";
import { OptionsScreen } from "@/features/alchemy/shared/screens";
import type { ScreenRouteContext } from "./types";

export function buildOptionsScreen(ctx: ScreenRouteContext) {
  const { appValues, appActions, onOpenBattleMenu, onClearSaveData, onUnlockAllDevMode } = ctx;
  return (
    <OptionsScreen
      onOpenMenu={onOpenBattleMenu}
      display={{
        selectedAspectRatio: appValues.selectedAspectRatio,
        onAspectRatioChange: appActions.setSelectedAspectRatio,
        displayMode: appValues.displayMode,
        onDisplayModeChange: appActions.setDisplayMode,
        showDisplayMode: platform.isDesktop,
        uiScale: appValues.uiScale,
        onUiScaleChange: appActions.setUiScale,
        brightness: appValues.brightness,
        onBrightnessChange: appActions.setBrightness,
      }}
      audio={{
        masterVol: appValues.masterVol,
        musicVol: appValues.musicVol,
        sfxVol: appValues.sfxVol,
        onMasterVolChange: appActions.setMasterVol,
        onMusicVolChange: appActions.setMusicVol,
        onSfxVolChange: appActions.setSfxVol,
        muteInBackground: appValues.muteInBackground,
        onMuteInBackgroundChange: appActions.setMuteInBackground,
      }}
      gameplay={{ autoEndTurn: appValues.autoEndTurn, onAutoEndTurnChange: appActions.setAutoEndTurn }}
      saveData={{
        showClearSaveConfirm: appValues.showClearSaveConfirm,
        onOpenClearSaveConfirm: () => appActions.setShowClearSaveConfirm(true),
        onCloseClearSaveConfirm: () => appActions.setShowClearSaveConfirm(false),
        onConfirmClearSave: onClearSaveData,
        onResetOptions: appActions.resetOptionsToDefault,
      }}
      dev={{ onUnlockAll: onUnlockAllDevMode }}
    />
  );
}
