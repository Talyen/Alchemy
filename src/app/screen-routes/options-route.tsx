import { useShallow } from "zustand/react/shallow";
import { platform } from "@/lib/platform";
import { OptionsScreen } from "@/features/alchemy/shared/screens";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useAppActions } from "@/features/alchemy/shared/stores/store-actions";
import type { ScreenRouteContext } from "./types";

function OptionsScreenRoute({
  onOpenBattleMenu,
  onClearSaveData,
  onUnlockAllDevMode,
}: Pick<ScreenRouteContext, "onOpenBattleMenu" | "onClearSaveData" | "onUnlockAllDevMode">) {
  const appValues = useAppStore(
    useShallow((s) => ({
      selectedAspectRatio: s.selectedAspectRatio,
      displayMode: s.displayMode,
      uiScale: s.uiScale,
      brightness: s.brightness,
      masterVol: s.masterVol,
      musicVol: s.musicVol,
      sfxVol: s.sfxVol,
      muteInBackground: s.muteInBackground,
      autoEndTurn: s.autoEndTurn,
      showClearSaveConfirm: s.showClearSaveConfirm,
    })),
  );
  const appActions = useAppActions();

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

export function buildOptionsScreen(ctx: ScreenRouteContext) {
  return (
    <OptionsScreenRoute
      onOpenBattleMenu={ctx.onOpenBattleMenu}
      onClearSaveData={ctx.onClearSaveData}
      onUnlockAllDevMode={ctx.onUnlockAllDevMode}
    />
  );
}
