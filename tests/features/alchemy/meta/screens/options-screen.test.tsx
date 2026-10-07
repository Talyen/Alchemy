import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OptionsScreen } from "@/features/alchemy/meta/screens/options-screen";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

const defaultProps = {
  onBack: vi.fn(),
  display: {
    selectedAspectRatio: "auto" as const,
    onAspectRatioChange: vi.fn(),
    displayMode: "windowed" as const,
    onDisplayModeChange: vi.fn(),
    showDisplayMode: false,
    brightness: 100,
    onBrightnessChange: vi.fn(),
    backgroundParticlesIntensity: 100,
    onBackgroundParticlesIntensityChange: vi.fn(),
    backgroundGlowIntensity: 100,
    onBackgroundGlowIntensityChange: vi.fn(),
    gameSizePercent: 100,
    tooltipSizePercent: 100,
    onGameSizeChange: vi.fn(),
    onTooltipSizeChange: vi.fn(),
  },
  audio: {
    masterVolume: 100,
    musicVolume: 100,
    sfxVolume: 100,
    onMasterVolumeChange: vi.fn(),
    onMusicVolumeChange: vi.fn(),
    onSfxVolumeChange: vi.fn(),
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
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
  });

  it("keeps volume controls independent and lets players mute background audio", async () => {
    const audio = {
      ...defaultProps.audio,
      onMasterVolumeChange: vi.fn(),
      onMusicVolumeChange: vi.fn(),
      onSfxVolumeChange: vi.fn(),
      onMuteInBackgroundChange: vi.fn(),
    };
    render(<OptionsScreen {...defaultProps} audio={audio} />);
    fireEvent.click(screen.getByRole("button", { name: "Sound" }));
    fireEvent.change(await screen.findByRole("slider", { name: "Music Volume" }), { target: { value: "40" } });
    expect(audio.onMusicVolumeChange).toHaveBeenCalledExactlyOnceWith(40);
    expect(audio.onMasterVolumeChange).not.toHaveBeenCalled();
    expect(audio.onSfxVolumeChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("slider", { name: "Overall Volume" }), { target: { value: "60" } });
    fireEvent.change(screen.getByRole("slider", { name: "Sound Effects Volume" }), { target: { value: "20" } });
    expect(audio.onMasterVolumeChange).toHaveBeenCalledExactlyOnceWith(60);
    expect(audio.onSfxVolumeChange).toHaveBeenCalledExactlyOnceWith(20);
    fireEvent.click(screen.getByRole("switch", { name: "Mute in Background" }));
    expect(audio.onMuteInBackgroundChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("groups display options and reports background intensity changes", () => {
    const onBackgroundParticlesIntensityChange = vi.fn();
    const onBackgroundGlowIntensityChange = vi.fn();
    render(
      <OptionsScreen
        {...defaultProps}
        display={{
          ...defaultProps.display,
          onBackgroundParticlesIntensityChange,
          onBackgroundGlowIntensityChange,
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
    expect(onBackgroundParticlesIntensityChange).toHaveBeenCalledWith(40);
    expect(onBackgroundGlowIntensityChange).toHaveBeenCalledWith(60);
  });

  it("lets players change the remember auto-battle preference", async () => {
    const onRememberAutoplayPreferenceChange = vi.fn();
    render(
      <OptionsScreen {...defaultProps} gameplay={{ ...defaultProps.gameplay, onRememberAutoplayPreferenceChange }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Gameplay" }));
    fireEvent.click(await screen.findByRole("switch", { name: "Remember Auto-Battle Preference" }));
    expect(onRememberAutoplayPreferenceChange).toHaveBeenCalledWith(true);
  });

  it("shows display mode only when the platform supports it", () => {
    render(<OptionsScreen {...defaultProps} />);
    expect(screen.queryByText("Display Mode")).toBeNull();
    cleanup();

    render(<OptionsScreen {...defaultProps} display={{ ...defaultProps.display, showDisplayMode: true }} />);
    expect(screen.getByText("Display Mode")).toBeTruthy();
  });
});
