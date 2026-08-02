// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OptionsScreen } from "@/features/alchemy/meta/screens/options-screen";

const defaultProps = {
  onOpenMenu: vi.fn(),
  onBack: vi.fn(),
  display: {
    selectedAspectRatio: "auto" as const,
    onAspectRatioChange: vi.fn(),
    displayMode: "windowed" as const,
    onDisplayModeChange: vi.fn(),
    showDisplayMode: false,
    uiScale: "100" as const,
    onUiScaleChange: vi.fn(),
    brightness: 100,
    onBrightnessChange: vi.fn(),
  },
  audio: {
    masterVol: 100,
    musicVol: 100,
    sfxVol: 100,
    onMasterVolChange: vi.fn(),
    onMusicVolChange: vi.fn(),
    onSfxVolChange: vi.fn(),
    muteInBackground: false,
    onMuteInBackgroundChange: vi.fn(),
  },
  gameplay: {
    autoEndTurn: false,
    onAutoEndTurnChange: vi.fn(),
  },
  saveData: {
    showClearSaveConfirm: false,
    onOpenClearSaveConfirm: vi.fn(),
    onCloseClearSaveConfirm: vi.fn(),
    onConfirmClearSave: vi.fn(),
    onResetOptions: vi.fn(),
  },
  dev: {
    onUnlockAll: vi.fn(),
  },
};

describe("OptionsScreen", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("calls onBack when the Back button is clicked", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<OptionsScreen {...defaultProps} onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("explains that UI Scale targets text and fixed-size controls", () => {
    render(<OptionsScreen {...defaultProps} />);

    expect(screen.getByText("Adjusts text and fixed-size controls.")).toBeTruthy();
  });
});
