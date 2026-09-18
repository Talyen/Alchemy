import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { optionsScreenRoutes } from "@/app/screen-routes/options-screen-route";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import {
  flushDeviceDisplayPreferences,
  initDeviceDisplayPreferences,
  useDeviceDisplayStore,
} from "@/features/alchemy/shared/stores/device-display-store";
import { DEVICE_DISPLAY_STORAGE_KEY } from "@/features/alchemy/shared/storage";
import type { OptionsRouteCtx } from "@/app/screen-routes/route-ctx";

interface OptionsScreenStubProps {
  display: {
    selectedAspectRatio: string;
    onAspectRatioChange: (value: "16:9") => void;
  };
  audio: {
    musicVolume: number;
    onMusicVolumeChange: (value: number) => void;
  };
  saveData: {
    showClearSaveConfirm: boolean;
    onOpenClearSaveConfirm: () => void;
    onCloseClearSaveConfirm: () => void;
    onResetOptions: () => void;
  };
}

vi.mock("@/features/alchemy/meta/screens", () => ({
  OptionsScreen: ({ display, audio, saveData }: OptionsScreenStubProps) => (
    <div>
      <output data-testid="aspect-ratio">{display.selectedAspectRatio}</output>
      <output data-testid="music-volume">{audio.musicVolume}</output>
      <output data-testid="clear-save-confirm">{String(saveData.showClearSaveConfirm)}</output>
      <button type="button" onClick={() => display.onAspectRatioChange("16:9")}>
        Change Aspect Ratio
      </button>
      <button type="button" onClick={() => audio.onMusicVolumeChange(25)}>
        Change Music Volume
      </button>
      <button type="button" onClick={saveData.onOpenClearSaveConfirm}>
        Open Confirm
      </button>
      <button type="button" onClick={saveData.onCloseClearSaveConfirm}>
        Close Confirm
      </button>
      <button type="button" onClick={saveData.onResetOptions}>
        Reset Options
      </button>
    </div>
  ),
}));

const routeContext: OptionsRouteCtx = {
  onClearSaveData: vi.fn(),
  onUnlockAllDevMode: vi.fn(),
  onBack: vi.fn(),
  onOpenGameMenu: vi.fn(),
};

describe("options screen route", () => {
  beforeEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
    useUiStore.getState().setShowClearSaveConfirm(false);
    localStorage.removeItem(DEVICE_DISPLAY_STORAGE_KEY);
    initDeviceDisplayPreferences();
  });

  afterEach(() => {
    cleanup();
    useDeviceDisplayStore.getState().resetSizes();
    flushDeviceDisplayPreferences();
  });

  it("binds saved settings and screen actions to the owning store", () => {
    render(optionsScreenRoutes.options(routeContext));

    expect(screen.getByTestId("aspect-ratio").textContent).toBe("auto");
    expect(screen.getByTestId("music-volume").textContent).toBe("50");

    fireEvent.click(screen.getByRole("button", { name: "Change Aspect Ratio" }));
    fireEvent.click(screen.getByRole("button", { name: "Change Music Volume" }));

    expect(useSettingsStore.getState()).toMatchObject({ selectedAspectRatio: "16:9", musicVolume: 25 });

    fireEvent.click(screen.getByRole("button", { name: "Reset Options" }));
    expect(useSettingsStore.getState()).toMatchObject({ selectedAspectRatio: "auto", musicVolume: 50 });
  });

  it("resets device sizes alongside settings on Reset Options", () => {
    useDeviceDisplayStore.getState().setGameSizePercent(85);
    render(optionsScreenRoutes.options(routeContext));

    fireEvent.click(screen.getByRole("button", { name: "Reset Options" }));

    expect(useDeviceDisplayStore.getState()).toMatchObject({ gameSizePercent: 100, tooltipSizePercent: 100 });
  });

  it("binds the clear-save dialog to transient UI state", () => {
    render(optionsScreenRoutes.options(routeContext));
    expect(screen.getByTestId("clear-save-confirm").textContent).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Open Confirm" }));
    expect(useUiStore.getState().showClearSaveConfirm).toBe(true);
    expect(screen.getByTestId("clear-save-confirm").textContent).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Close Confirm" }));
    expect(useUiStore.getState().showClearSaveConfirm).toBe(false);
  });
});
