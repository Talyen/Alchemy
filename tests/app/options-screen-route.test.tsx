import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { optionsScreenRoutes } from "@/app/screen-routes/options-screen-route";
import { useSettingsStore } from "@/features/alchemy/shared/stores/react/settings-store";
import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";
import {
  flushDeviceDisplayPreferences,
  initDeviceDisplayPreferences,
  useDeviceDisplayStore,
} from "@/features/alchemy/shared/stores/react/device-display-store";
import { DEVICE_DISPLAY_STORAGE_KEY } from "@/features/alchemy/shared/storage";
import { isDesktop } from "@/lib/platform";
import { installDisabledAnimationsForTests } from "../helpers/animation-test";
import { installReadyArtworkForTests, waitForArtwork } from "../helpers/artwork-test";
import type { OptionsRouteCtx } from "@/app/screen-routes/route-ctx";

const OptionsRoute = optionsScreenRoutes.options;
vi.mock("@/lib/platform", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/platform")>()),
  isDesktop: vi.fn(() => false),
}));

const routeContext: OptionsRouteCtx = {
  onClearSaveData: vi.fn(),
  onUnlockAllDevMode: vi.fn(),
  onBack: vi.fn(),
  onOpenGameMenu: vi.fn(),
};

function changeSlider(name: string, value: number) {
  fireEvent.change(screen.getByRole("slider", { name, exact: true }), { target: { value: String(value) } });
  expect(screen.getByRole("slider", { name, exact: true })).toHaveProperty("value", String(value));
}

describe("connected Options screen", () => {
  installDisabledAnimationsForTests();
  installReadyArtworkForTests();

  beforeEach(() => {
    vi.mocked(isDesktop).mockReturnValue(false);
    useSettingsStore.getState().resetToDefaults();
    useUiStore.getState().setShowClearSaveConfirm(false);
    localStorage.removeItem(DEVICE_DISPLAY_STORAGE_KEY);
    initDeviceDisplayPreferences();
  });

  afterEach(() => {
    cleanup();
    useSettingsStore.getState().resetToDefaults();
    useUiStore.getState().setShowClearSaveConfirm(false);
    useDeviceDisplayStore.getState().resetSizes();
    flushDeviceDisplayPreferences();
  });

  it("changes independent audio channels and saves gameplay preferences through the real controls", async () => {
    useSettingsStore.getState().setMuteInBackground(false);
    render(<OptionsRoute {...routeContext} />);
    fireEvent.click(screen.getByRole("button", { name: "Sound", exact: true }));
    await screen.findByRole("slider", { name: "Music Volume" });
    changeSlider("Music Volume", 40);
    expect(useSettingsStore.getState()).toMatchObject({ musicVolume: 40, masterVolume: 50, sfxVolume: 50 });
    changeSlider("Overall Volume", 60);
    changeSlider("Sound Effects Volume", 20);
    fireEvent.click(screen.getByRole("switch", { name: "Mute in Background" }));
    fireEvent.click(screen.getByRole("switch", { name: "Boss Lyrics" }));
    expect(useSettingsStore.getState()).toMatchObject({
      masterVolume: 60,
      musicVolume: 40,
      sfxVolume: 20,
      muteInBackground: true,
      bossLyricsEnabled: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "Gameplay", exact: true }));
    fireEvent.click(await screen.findByRole("switch", { name: "Remember Auto-Battle Preference" }));
    const autoEquip = screen.getByRole("switch", { name: /Auto Equip/ });
    expect(autoEquip.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(autoEquip);
    expect(autoEquip.getAttribute("aria-checked")).toBe("false");
    expect(useSettingsStore.getState()).toMatchObject({ rememberAutoplayPreference: true, autoEquip: false });
    // Re-entering a panel reads the committed values instead of the initial props.
    fireEvent.click(screen.getByRole("button", { name: "Sound", exact: true }));
    expect(await screen.findByRole("slider", { name: "Music Volume" })).toHaveProperty("value", "40");
  });

  it("changes both size controls independently and resets settings and device sizes without requesting a save wipe", async () => {
    const onClearSaveData = vi.fn();
    useSettingsStore.getState().setMusicVolume(25);
    useSettingsStore.getState().setAutoEquip(false);
    render(<OptionsRoute {...routeContext} onClearSaveData={onClearSaveData} />);
    changeSlider("Game Size", 85);
    changeSlider("Tooltip Size", 125);
    changeSlider("Background Particles", 40);
    changeSlider("Background Glow", 60);
    expect(useDeviceDisplayStore.getState()).toMatchObject({ gameSizePercent: 85, tooltipSizePercent: 125 });
    expect(useSettingsStore.getState()).toMatchObject({
      backgroundParticlesIntensity: 40,
      backgroundGlowIntensity: 60,
    });
    fireEvent.click(screen.getByRole("button", { name: "Other", exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Reset to Default", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Display", exact: true }));
    expect(useDeviceDisplayStore.getState()).toMatchObject({ gameSizePercent: 100, tooltipSizePercent: 100 });
    expect(useSettingsStore.getState()).toMatchObject({
      backgroundParticlesIntensity: 100,
      backgroundGlowIntensity: 100,
      musicVolume: 50,
      autoEquip: true,
    });
    expect(await screen.findByRole("slider", { name: "Game Size" })).toHaveProperty("value", "100");
    expect(screen.getByRole("slider", { name: "Tooltip Size" })).toHaveProperty("value", "100");
    expect(onClearSaveData).not.toHaveBeenCalled();
  });

  it("cancels a clear-save request without wiping and forwards only a confirmed request", async () => {
    const onClearSaveData = vi.fn();
    render(<OptionsRoute {...routeContext} onClearSaveData={onClearSaveData} />);
    fireEvent.click(screen.getByRole("button", { name: "Other", exact: true }));
    const open = await screen.findByRole("button", { name: "Clear Save Data", exact: true });
    fireEvent.click(open);
    const dialog = await screen.findByRole("dialog", { name: "Clear Save Data" });
    await waitForArtwork();
    expect(useUiStore.getState().showClearSaveConfirm).toBe(true);
    expect(within(dialog).getByText(/This cannot be undone/)).toBeTruthy();
    expect(onClearSaveData).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(useUiStore.getState().showClearSaveConfirm).toBe(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onClearSaveData).not.toHaveBeenCalled();
    fireEvent.click(open);
    await waitForArtwork();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear Save Data" }));
    expect(onClearSaveData).toHaveBeenCalledOnce();
  });

  it("offers display mode only on desktop", () => {
    const { rerender } = render(<OptionsRoute {...routeContext} />);
    expect(screen.queryByRole("combobox", { name: "Display Mode" })).toBeNull();
    vi.mocked(isDesktop).mockReturnValue(true);
    rerender(<OptionsRoute {...routeContext} />);
    expect(screen.getByRole("combobox", { name: "Display Mode" })).toBeTruthy();
  });
});
