import { useSyncExternalStore } from "react";
import { languagePreference, subscribeLanguage, setLanguagePreference } from "@/lib/localization/language";
import { playUISound } from "@/lib/audio";
import { useDeviceDisplayStore } from "@/features/alchemy/shared/stores/react/device-display-store";
import { isDesktop } from "@/lib/platform";
import { OptionsScreen } from "@/features/alchemy/meta/screens";
import { useAppSettings, useSettingsActions } from "@/features/alchemy/shared/stores/react/settings-store";
import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";
import type { OptionsRouteCtx } from "./route-ctx";

const noop = (): void => {};

function OptionsScreenRoute({ onClearSaveData, onUnlockAllDevMode, onBack, onOpenGameMenu }: OptionsRouteCtx) {
  const selectedLanguage = useSyncExternalStore(subscribeLanguage, languagePreference, languagePreference);
  const settings = useAppSettings();
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
        languagePreference: selectedLanguage,
        onLanguageChange: setLanguagePreference,
        showDisplayMode: isDesktop(),
        gameSizePercent,
        tooltipSizePercent,
        onGameSizeChange: setGameSizePercent,
        onTooltipSizeChange: setTooltipSizePercent,
      }}
      preferences={{ values: settings, actions }}
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
          setLanguagePreference("auto");
          playUISound("destructiveConfirm");
        },
      }}
      dev={{ onUnlockAll: onUnlockAllDevMode }}
    />
  );
}

export const optionsScreenRoutes = { options: OptionsScreenRoute };
