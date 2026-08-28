import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
    brightness: 100,
    onBrightnessChange: vi.fn(),
  },
  audio: {
    masterVolume: 100,
    musicVolume: 100,
    sfxVolume: 100,
    onMasterVolChange: vi.fn(),
    onMusicVolChange: vi.fn(),
    onSfxVolChange: vi.fn(),
    muteInBackground: false,
    onMuteInBackgroundChange: vi.fn(),
  },
  gameplay: {
    autoEndTurn: false,
    onAutoEndTurnChange: vi.fn(),
    rememberAutoplayPreference: false,
    onRememberAutoplayPreferenceChange: vi.fn(),
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
  });

  it("calls onBack when the Back button is clicked", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<OptionsScreen {...defaultProps} onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders display options without a UI Scale control", () => {
    render(<OptionsScreen {...defaultProps} />);

    expect(screen.queryByText("UI Scale")).toBeNull();
    expect(screen.getByText("Brightness")).toBeTruthy();
  });

  it("renders the remember auto-battle toggle on the gameplay tab", async () => {
    const user = userEvent.setup();
    render(<OptionsScreen {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Sound" }));
    await waitFor(() => {
      expect(screen.getByText("Mute in Background")).toBeTruthy();
    });
    expect(
      screen.queryByText("Silence music and effects while the game is in a background tab or minimized."),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Gameplay" }));
    await waitFor(() => {
      expect(screen.getByText("Remember Auto-Battle Preference")).toBeTruthy();
    });
    expect(screen.queryByText("Automatically end your turn when no cards in hand can be played.")).toBeNull();
    expect(screen.queryByText("Restore the in-battle Autoplay toggle across battles.")).toBeNull();
  });

  it("keeps developer controls in a bottom-only section on the Other tab", async () => {
    const user = userEvent.setup();
    render(<OptionsScreen {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Other" }));
    await waitFor(() => {
      expect(screen.getByText("Dev Only")).toBeTruthy();
    });

    const devSection = screen.getByText("Dev Only").closest("section");
    expect(devSection?.parentElement?.lastElementChild).toBe(devSection);
    expect(devSection?.textContent).toContain("Dev / QA Unlocks");
    expect(devSection?.textContent).toContain("Error Log");
  });
});
