import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { optionsScreenRoutes } from "@/app/screen-routes/options-screen-route";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import type { OptionsRouteCtx } from "@/app/screen-routes/route-ctx";

interface OptionsScreenStubProps {
  display: {
    selectedAspectRatio: string;
    onAspectRatioChange: (value: "16:9") => void;
  };
  audio: {
    musicVolume: number;
    onMusicVolChange: (value: number) => void;
  };
  saveData: {
    onResetOptions: () => void;
  };
}

vi.mock("@/features/alchemy/meta/screens", () => ({
  OptionsScreen: ({ display, audio, saveData }: OptionsScreenStubProps) => (
    <div>
      <output data-testid="aspect-ratio">{display.selectedAspectRatio}</output>
      <output data-testid="music-volume">{audio.musicVolume}</output>
      <button type="button" onClick={() => display.onAspectRatioChange("16:9")}>
        Change Aspect Ratio
      </button>
      <button type="button" onClick={() => audio.onMusicVolChange(25)}>
        Change Music Volume
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
  onBackFromOptions: vi.fn(),
  onOpenGameMenu: vi.fn(),
};

describe("options screen route", () => {
  beforeEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  afterEach(cleanup);

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
});
