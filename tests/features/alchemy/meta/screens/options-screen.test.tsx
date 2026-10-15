import { createSettingsStore } from "@/features/alchemy/shared/stores/settings-state";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OptionsScreen } from "@/features/alchemy/meta/screens/options-screen";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

const defaultProps = {
  onBack: vi.fn(),
  display: {
    languagePreference: "auto" as const,
    onLanguageChange: vi.fn(),
    showDisplayMode: false,
    gameSizePercent: 100,
    tooltipSizePercent: 100,
    onGameSizeChange: vi.fn(),
    onTooltipSizeChange: vi.fn(),
  },
  preferences: {
    values: { ...createSettingsStore().getState(), muteInBackground: false },
    actions: createSettingsStore().getState(),
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
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
  });

  it("keeps volume controls independent and lets players mute background audio", async () => {
    const actions = {
      ...defaultProps.preferences.actions,
      setMasterVolume: vi.fn(),
      setMusicVolume: vi.fn(),
      setSfxVolume: vi.fn(),
      setMuteInBackground: vi.fn(),
      setBossLyricsEnabled: vi.fn(),
    };
    render(<OptionsScreen {...defaultProps} preferences={{ ...defaultProps.preferences, actions }} />);
    fireEvent.click(screen.getByRole("button", { name: "Sound" }));
    fireEvent.change(await screen.findByRole("slider", { name: "Music Volume" }), { target: { value: "40" } });
    expect(actions.setMusicVolume).toHaveBeenCalledExactlyOnceWith(40);
    expect(actions.setMasterVolume).not.toHaveBeenCalled();
    expect(actions.setSfxVolume).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("slider", { name: "Overall Volume" }), { target: { value: "60" } });
    fireEvent.change(screen.getByRole("slider", { name: "Sound Effects Volume" }), { target: { value: "20" } });
    expect(actions.setMasterVolume).toHaveBeenCalledExactlyOnceWith(60);
    expect(actions.setSfxVolume).toHaveBeenCalledExactlyOnceWith(20);
    fireEvent.click(screen.getByRole("switch", { name: "Mute in Background" }));
    expect(actions.setMuteInBackground).toHaveBeenCalledExactlyOnceWith(true);
    fireEvent.click(screen.getByRole("switch", { name: "Boss Lyrics" }));
    expect(actions.setBossLyricsEnabled).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("groups display options and reports background intensity changes", () => {
    const setBackgroundParticlesIntensity = vi.fn();
    const setBackgroundGlowIntensity = vi.fn();
    render(
      <OptionsScreen
        {...defaultProps}
        preferences={{
          ...defaultProps.preferences,
          actions: { ...defaultProps.preferences.actions, setBackgroundParticlesIntensity, setBackgroundGlowIntensity },
        }}
      />,
    );

    for (const name of ["Display", "Background"]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    fireEvent.change(screen.getByRole("slider", { name: "Background Particles" }), {
      target: { value: "40" },
    });
    fireEvent.change(screen.getByRole("slider", { name: "Background Glow" }), {
      target: { value: "60" },
    });
    expect(setBackgroundParticlesIntensity).toHaveBeenCalledWith(40);
    expect(setBackgroundGlowIntensity).toHaveBeenCalledWith(60);
  });

  it("lets players change the remember auto-battle preference", async () => {
    const setRememberAutoplayPreference = vi.fn();
    render(
      <OptionsScreen
        {...defaultProps}
        preferences={{
          ...defaultProps.preferences,
          actions: { ...defaultProps.preferences.actions, setRememberAutoplayPreference },
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Gameplay" }));
    fireEvent.click(await screen.findByRole("switch", { name: "Remember Auto-Battle Preference" }));
    expect(setRememberAutoplayPreference).toHaveBeenCalledWith(true);
  });

  it("shows display mode only when the platform supports it", () => {
    render(<OptionsScreen {...defaultProps} />);
    expect(screen.queryByText("Display Mode")).toBeNull();
    cleanup();

    render(<OptionsScreen {...defaultProps} display={{ ...defaultProps.display, showDisplayMode: true }} />);
    expect(screen.getByText("Display Mode")).toBeTruthy();
  });
});
